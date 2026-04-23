import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CuotasPagadasEntity } from './cuotas-pagadas.entity';
import { PaginacionDto, PaginacionResponseDto } from './cuotas-pagadas.dto';
import {
  CacheEntry,
  buildStableCacheKey,
  captureQuerySnapshot,
  countActiveFilters,
  getCacheValue,
  measureAsync,
  parsePositiveNumber,
  QueryDebugSnapshot,
  setCacheValue,
} from '../common/query-performance.util';

type CuotasPagadasResponse = PaginacionResponseDto<CuotasPagadasEntity>;

@Injectable()
export class CuotasPagadasService {
  private readonly logger = new Logger(CuotasPagadasService.name);
  private readonly cache = new Map<string, CacheEntry<CuotasPagadasResponse>>();
  private readonly inFlight = new Map<string, Promise<CuotasPagadasResponse>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly logSlowSql: boolean;

  constructor(
    @InjectRepository(CuotasPagadasEntity)
    private repo: Repository<CuotasPagadasEntity>,
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('CUOTAS_PAGADAS_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('CUOTAS_PAGADAS_CACHE_MAX_ITEMS'),
      200,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(dto: PaginacionDto): Promise<CuotasPagadasResponse> {
    const startedAt = Date.now();
    const limite = Math.min(dto.limite || 100, 1000); // máximo 1000 por página
    const offset = Math.max(dto.offset || 0, 0);
    const incluirTotal = dto.incluirTotal === true;
    const pagina = Math.floor(offset / limite) + 1;
    const normalizedDto: PaginacionDto = {
      ...dto,
      limite,
      offset,
      incluirTotal,
    };
    const normalizedDtoRecord = normalizedDto as unknown as Record<
      string,
      unknown
    >;

    const cacheKey = buildStableCacheKey(normalizedDtoRecord);
    const cached = getCacheValue(this.cache, cacheKey);
    if (cached) {
      this.logger.debug(
        `cache hit cuotas-pagadas limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join cuotas-pagadas limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return pending;
    }

    const loadPromise = (async () => {
      // ── Construcción dinámica de filtros ──────────────────────────────────────
      const qb = this.repo.createQueryBuilder('v');
      qb.where('v.numeroCuota > :numeroCuotaMinima', {
        numeroCuotaMinima: 1,
      });

      if (normalizedDto.numeroContrato) {
        qb.andWhere('v.numeroContrato = :numeroContrato', {
          numeroContrato: normalizedDto.numeroContrato,
        });
      }
      if (normalizedDto.documento) {
        qb.andWhere('v.documento = :documento', {
          documento: normalizedDto.documento,
        });
      }
      if (normalizedDto.idCliente) {
        qb.andWhere('v.idCliente = :idCliente', {
          idCliente: normalizedDto.idCliente,
        });
      }
      if (normalizedDto.sucursal) {
        qb.andWhere('v.sucursal = :sucursal', {
          sucursal: normalizedDto.sucursal,
        });
      }
      if (normalizedDto.estadoActualContrato) {
        qb.andWhere('v.estadoActualContrato = :estado', {
          estado: normalizedDto.estadoActualContrato,
        });
      }
      if (normalizedDto.moneda) {
        qb.andWhere('v.moneda = :moneda', { moneda: normalizedDto.moneda });
      }
      if (normalizedDto.fechaDesde) {
        qb.andWhere("v.fechaPago >= TO_DATE(:fechaDesde, 'YYYY-MM-DD')", {
          fechaDesde: normalizedDto.fechaDesde,
        });
      }
      if (normalizedDto.fechaHasta) {
        qb.andWhere("v.fechaPago <= TO_DATE(:fechaHasta, 'YYYY-MM-DD')", {
          fechaHasta: normalizedDto.fechaHasta,
        });
      }

      if (!incluirTotal) {
        const pagedDataQb = qb
          .clone()
          .orderBy('v.fechaPago', 'DESC')
          .skip(offset)
          .take(limite + 1);
        const querySnapshots = [
          captureQuerySnapshot('data', pagedDataQb),
        ] as QueryDebugSnapshot[];
        const dataResult = await measureAsync(() =>
          pagedDataQb.getMany(),
        );

        const tieneMas = dataResult.result.length > limite;
        const data = this.mapCuotasPagadasRows(
          dataResult.result.slice(0, limite),
        );
        const response: CuotasPagadasResponse = {
          data,
          total: null,
          limite,
          offset,
          pagina,
          totalPaginas: null,
          incluirTotal: false,
          tieneMas,
        };

        setCacheValue(
          this.cache,
          cacheKey,
          response,
          this.cacheTtlMs,
          this.cacheMaxItems,
        );
        this.logSlowRequest({
          startedAt,
          dataDurationMs: dataResult.durationMs,
          countDurationMs: null,
          limite,
          offset,
          incluirTotal: false,
          rows: response.data.length,
          filters: countActiveFilters(normalizedDtoRecord, [
            'limite',
            'offset',
            'incluirTotal',
          ]),
          querySnapshots,
        });

        return response;
      }

      const countQb = qb.clone();
      const pagedDataQb = qb
        .clone()
        .orderBy('v.fechaPago', 'DESC')
        .skip(offset)
        .take(limite);
      const querySnapshots = [
        captureQuerySnapshot('count', countQb),
        captureQuerySnapshot('data', pagedDataQb),
      ] as QueryDebugSnapshot[];

      const [countResult, dataResult] = await Promise.all([
        measureAsync(() => countQb.getCount()),
        measureAsync(() => pagedDataQb.getMany()),
      ]);

      const data = this.mapCuotasPagadasRows(dataResult.result);
      const response: CuotasPagadasResponse = {
        data,
        total: countResult.result,
        limite,
        offset,
        pagina,
        totalPaginas: Math.ceil(countResult.result / limite),
        incluirTotal: true,
      };

      setCacheValue(
        this.cache,
        cacheKey,
        response,
        this.cacheTtlMs,
        this.cacheMaxItems,
      );
      this.logSlowRequest({
        startedAt,
        dataDurationMs: dataResult.durationMs,
        countDurationMs: countResult.durationMs,
        limite,
        offset,
        incluirTotal: true,
        rows: response.data.length,
        filters: countActiveFilters(normalizedDtoRecord, [
          'limite',
          'offset',
          'incluirTotal',
        ]),
        querySnapshots,
      });

      return response;
    })();

    this.inFlight.set(cacheKey, loadPromise);
    try {
      return await loadPromise;
    } catch (error) {
      this.rethrowKnownOracleError(error);
    } finally {
      if (this.inFlight.get(cacheKey) === loadPromise) {
        this.inFlight.delete(cacheKey);
      }
    }
  }

  // ── Método alternativo con SQL nativo para Oracle 11g o mejor rendimiento ──
  async findAllNativo(dto: PaginacionDto): Promise<PaginacionResponseDto<any>> {
    const limite = Math.min(dto.limite || 100, 1000);
    const offset = dto.offset || 0;

    // Parámetros dinámicos
    const params: any = { limite, offset, numeroCuotaMinima: 1 };
    const filtros: string[] = ['NUMERO_CUOTA > :numeroCuotaMinima'];

    if (dto.numeroContrato) {
      filtros.push(`NUMERO_CONTRATO = :numeroContrato`);
      params.numeroContrato = dto.numeroContrato;
    }
    if (dto.documento) {
      filtros.push(`DOCUMENTO = :documento`);
      params.documento = dto.documento;
    }
    if (dto.idCliente) {
      filtros.push(`ID_CLIENTE = :idCliente`);
      params.idCliente = dto.idCliente;
    }
    if (dto.sucursal) {
      filtros.push(`SUCURSAL = :sucursal`);
      params.sucursal = dto.sucursal;
    }
    if (dto.estadoActualContrato) {
      filtros.push(`ESTADO_ACTUAL_CONTRATO = :estado`);
      params.estado = dto.estadoActualContrato;
    }
    if (dto.moneda) {
      filtros.push(`MONEDA = :moneda`);
      params.moneda = dto.moneda;
    }
    if (dto.fechaDesde) {
      filtros.push(`FECHA_PAGO >= TO_DATE(:fechaDesde, 'YYYY-MM-DD')`);
      params.fechaDesde = dto.fechaDesde;
    }
    if (dto.fechaHasta) {
      filtros.push(`FECHA_PAGO <= TO_DATE(:fechaHasta, 'YYYY-MM-DD')`);
      params.fechaHasta = dto.fechaHasta;
    }

    const whereClause = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

    // ROW_NUMBER() para compatibilidad con Oracle 11g también
    const sqlData = `
      SELECT *
      FROM (
        SELECT v.*, ROW_NUMBER() OVER (ORDER BY FECHA_PAGO DESC) AS RN
        FROM ADCC.CBI_CUOTAS_PAGADAS_V v
        ${whereClause}
      )
      WHERE RN > :offset AND RN <= (:offset + :limite)
    `;

    const sqlCount = `
      SELECT COUNT(*) AS TOTAL
      FROM ADCC.CBI_CUOTAS_PAGADAS_V
      ${whereClause}
    `;

    let dataResult: any[];
    let countResult: any[];
    try {
      [dataResult, countResult] = await Promise.all([
        this.dataSource.query(sqlData, params),
        this.dataSource.query(sqlCount, params),
      ]);
    } catch (error) {
      this.rethrowKnownOracleError(error);
    }

    const total = parseInt(countResult[0]?.TOTAL || '0');

    return {
      data: this.mapCuotasPagadasRowsNativo(dataResult),
      total,
      limite,
      offset,
      pagina: Math.floor(offset / limite) + 1,
      totalPaginas: Math.ceil(total / limite),
      incluirTotal: true,
    };
  }

  private logSlowRequest(input: {
    startedAt: number;
    dataDurationMs: number;
    countDurationMs: number | null;
    limite: number;
    offset: number;
    incluirTotal: boolean;
    rows: number;
    filters: number;
    querySnapshots?: QueryDebugSnapshot[];
  }) {
    const totalDurationMs = Date.now() - input.startedAt;
    if (
      totalDurationMs < 1000 &&
      input.dataDurationMs < 1000 &&
      (input.countDurationMs === null || input.countDurationMs < 1000)
    ) {
      return;
    }

    this.logger.warn(
      `findAll cuotas-pagadas lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} offset=${input.offset} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql cuotas-pagadas ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }

  private mapCuotasPagadasRows(
    rows: CuotasPagadasEntity[],
  ): CuotasPagadasEntity[] {
    return rows.map((row) => ({
      ...row,
      montoCuota: this.roundAmountUp(row.montoCuota),
      interesCobrado: this.roundAmountUp(row.interesCobrado),
      descuentoInteres: this.roundAmountUp(row.descuentoInteres),
      cuotaCobrada: this.calculateCuotaCobrada(row.montoCuota, row.notaCred),
      notaCred: this.roundAmountUp(row.notaCred),
    }));
  }

  private mapCuotasPagadasRowsNativo(rows: any[]): any[] {
    return rows.map((row) => ({
      ...row,
      MONTO_CUOTA: this.roundAmountUp(row.MONTO_CUOTA),
      INTERES_COBRADO: this.roundAmountUp(row.INTERES_COBRADO),
      DESCUENTO_INTERES: this.roundAmountUp(row.DESCUENTO_INTERES),
      CUOTA_COBRADA: this.calculateCuotaCobrada(row.MONTO_CUOTA, row.NOTA_CRED),
      NOTA_CRED: this.roundAmountUp(row.NOTA_CRED),
    }));
  }

  private calculateCuotaCobrada(
    montoCuota: unknown,
    notaCred: unknown,
  ): number {
    return this.roundAmountUp(
      this.normalizeNumericValue(montoCuota) -
        this.normalizeNumericValue(notaCred),
    );
  }

  private roundAmountUp(value: unknown): number {
    return Math.ceil(this.normalizeNumericValue(value));
  }

  private normalizeNumericValue(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return 0;
      }

      const parsed = Number(normalized.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private rethrowKnownOracleError(error: unknown): never {
    const code = this.extractOracleErrorCode(error);
    const message = error instanceof Error ? error.message : String(error);

    if (code === 'ORA-04045' || code === 'ORA-16000') {
      this.logger.error(
        `cuotas-pagadas source unavailable code=${code} message=${message}`,
      );
      throw new ServiceUnavailableException(
        'La fuente Oracle ADCC.CBI_CUOTAS_PAGADAS_V esta invalida y no puede revalidarse porque la base esta en modo read-only. Debe corregirse o recompilarse en origen.',
      );
    }

    throw error;
  }

  private extractOracleErrorCode(error: unknown): string | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const candidate = error as { code?: unknown; message?: unknown };
    if (typeof candidate.code === 'string' && candidate.code.startsWith('ORA-')) {
      return candidate.code;
    }

    if (typeof candidate.message === 'string') {
      const match = candidate.message.match(/ORA-\d{5}/);
      return match?.[0] ?? null;
    }

    return null;
  }
}

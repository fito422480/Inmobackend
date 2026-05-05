import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  CacheEntry,
  buildStableCacheKey,
  countActiveFilters,
  getCacheValue,
  measureAsync,
  parsePositiveNumber,
  setCacheValue,
} from '../common/query-performance.util';
import {
  DetalleCuotaDto,
  PaginacionDto,
  PaginacionResponseDto,
} from './detalle-cuotas.dto';

type DetalleCuotasResponse = PaginacionResponseDto<DetalleCuotaDto>;

type OracleRow = {
  NUMERO_CONTRATO?: unknown;
  FECHA_VENCIMIENTO?: unknown;
  FECHA_PAGO?: unknown;
  NUMERO_CUOTA?: unknown;
  MONTO_CUOTA?: unknown;
  CUOTA_COBRADA?: unknown;
  MORA_CUOTA?: unknown;
  TOTAL?: unknown;
};

type QueryDebugSnapshot = {
  label: string;
  sql: string;
  parameters: Record<string, unknown>;
};

type QueryBundle = {
  dataSql: string;
  countSql: string;
  dataParams: Record<string, unknown>;
  countParams: Record<string, unknown>;
};

@Injectable()
export class DetalleCuotasService {
  private static readonly DEFAULT_MAX_LIMIT = 5000;
  private readonly logger = new Logger(DetalleCuotasService.name);
  private readonly cache = new Map<string, CacheEntry<DetalleCuotasResponse>>();
  private readonly inFlight = new Map<string, Promise<DetalleCuotasResponse>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly maxLimit: number;
  private readonly logSlowSql: boolean;

  constructor(
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('DETALLE_CUOTAS_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('DETALLE_CUOTAS_CACHE_MAX_ITEMS'),
      200,
    );
    this.maxLimit = parsePositiveNumber(
      this.configService.get('DETALLE_CUOTAS_MAX_LIMIT'),
      DetalleCuotasService.DEFAULT_MAX_LIMIT,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(dto: PaginacionDto): Promise<DetalleCuotasResponse> {
    this.validateDto(dto);

    const startedAt = Date.now();
    const limite = Math.min(Math.max(dto.limite || 100, 1), this.maxLimit);
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
        `cache hit detalle-cuotas limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join detalle-cuotas limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return pending;
    }

    const loadPromise = (async () => {
      const queryBundle = this.buildQueries(
        normalizedDto,
        incluirTotal ? limite : limite + 1,
        offset,
      );
      const querySnapshots: QueryDebugSnapshot[] = [
        this.captureQuerySnapshot(
          'data',
          queryBundle.dataSql,
          queryBundle.dataParams,
        ),
      ];

      if (!incluirTotal) {
        const dataResult = await measureAsync(() =>
          this.executeQuery(queryBundle.dataSql, queryBundle.dataParams),
        );

        const rows = dataResult.result as OracleRow[];
        const tieneMas = rows.length > limite;
        const response: DetalleCuotasResponse = {
          data: this.mapRows(rows.slice(0, limite)),
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

      querySnapshots.unshift(
        this.captureQuerySnapshot(
          'count',
          queryBundle.countSql,
          queryBundle.countParams,
        ),
      );

      const [countResult, dataResult] = await Promise.all([
        measureAsync(() =>
          this.executeQuery(queryBundle.countSql, queryBundle.countParams),
        ),
        measureAsync(() =>
          this.executeQuery(queryBundle.dataSql, queryBundle.dataParams),
        ),
      ]);

      const total = this.extractTotal(countResult.result as OracleRow[]);
      const response: DetalleCuotasResponse = {
        data: this.mapRows(dataResult.result as OracleRow[]),
        total,
        limite,
        offset,
        pagina,
        totalPaginas: Math.ceil(total / limite),
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

  private buildQueries(
    dto: PaginacionDto,
    limite: number,
    offset: number,
  ): QueryBundle {
    const params: Record<string, unknown> = { limite, offset };
    const paidWhere = this.buildSourceWhere('ccpv', dto, params);
    const pendingWhere = this.buildSourceWhere('ccv', dto, params);
    const unionSql = this.buildUnionSql(paidWhere, pendingWhere);

    const dataSql = `
      SELECT NUMERO_CONTRATO, FECHA_VENCIMIENTO, FECHA_PAGO, NUMERO_CUOTA, MONTO_CUOTA, CUOTA_COBRADA, MORA_CUOTA
      FROM (
        SELECT d.*,
               ROW_NUMBER() OVER (
                 ORDER BY d.NUMERO_CONTRATO ASC, d.NUMERO_CUOTA ASC
               ) AS RN
        FROM (
          ${unionSql}
        ) d
      )
      WHERE RN > :offset
        AND RN <= (:offset + :limite)
      ORDER BY NUMERO_CONTRATO ASC, NUMERO_CUOTA ASC
    `;

    const countSql = `
      SELECT COUNT(*) AS TOTAL
      FROM (
        ${unionSql}
      )
    `;

    return {
      dataSql: this.normalizeSql(dataSql),
      countSql: this.normalizeSql(countSql),
      dataParams: { ...params },
      countParams: this.omitPaginationParams(params),
    };
  }

  private buildUnionSql(
    paidWhere: string,
    pendingWhere: string,
  ): string {
    return `
      SELECT
        ccpv.NUMERO_CONTRATO,
        ccpv.FECHA_VENCIMIENTO,
        ccpv.FECHA_PAGO AS FECHA_PAGO,
        ccpv.NUMERO_CUOTA,
        ccpv.MONTO_CUOTA,
        ccpv.CUOTA_COBRADA,
        ccpv.MORA_CUOTA
      FROM ADCC.CBI_CUOTAS_PAGADAS_V ccpv
      ${paidWhere}

      UNION ALL

      SELECT
        ccv.NUMERO_CONTRATO,
        ccv.FECHA_VENCIMIENTO,
        CAST(NULL AS DATE) AS FECHA_PAGO,
        ccv.NUMERO_CUOTA,
        ccv.MONTO_CUOTA,
        CAST(NULL AS NUMBER) AS CUOTA_COBRADA,
        ccv.MORA_CUOTA
      FROM ADCC.CBI_CUOTAS_V ccv
      ${this.combinePendingWhere(pendingWhere)}
    `;
  }

  private buildSourceWhere(
    alias: string,
    dto: PaginacionDto,
    params: Record<string, unknown>,
  ): string {
    const clauses: string[] = [];

    if (dto.numeroContrato) {
      clauses.push(`${alias}.NUMERO_CONTRATO = :numeroContrato`);
      params.numeroContrato = dto.numeroContrato;
    }

    if (dto.numeroCuota !== undefined) {
      clauses.push(`${alias}.NUMERO_CUOTA = :numeroCuota`);
      params.numeroCuota = dto.numeroCuota;
    }

    if (dto.numeroCuotaDesde !== undefined) {
      clauses.push(`${alias}.NUMERO_CUOTA >= :numeroCuotaDesde`);
      params.numeroCuotaDesde = dto.numeroCuotaDesde;
    }

    if (dto.numeroCuotaHasta !== undefined) {
      clauses.push(`${alias}.NUMERO_CUOTA <= :numeroCuotaHasta`);
      params.numeroCuotaHasta = dto.numeroCuotaHasta;
    }

    if (dto.fechaVencimientoDesde) {
      clauses.push(
        `${alias}.FECHA_VENCIMIENTO >= TO_DATE(:fechaVencimientoDesde, 'YYYY-MM-DD')`,
      );
      params.fechaVencimientoDesde = dto.fechaVencimientoDesde;
    }

    if (dto.fechaVencimientoHasta) {
      clauses.push(
        `${alias}.FECHA_VENCIMIENTO <= TO_DATE(:fechaVencimientoHasta, 'YYYY-MM-DD')`,
      );
      params.fechaVencimientoHasta = dto.fechaVencimientoHasta;
    }

    if (!clauses.length) {
      return '';
    }

    return `WHERE ${clauses.join(' AND ')}`;
  }

  private combinePendingWhere(pendingWhere: string): string {
    const notExistsClause = `
      NOT EXISTS (
        SELECT 1
        FROM ADCC.CBI_CUOTAS_PAGADAS_V ccpv2
        WHERE ccpv2.NUMERO_CONTRATO = ccv.NUMERO_CONTRATO
          AND ccpv2.NUMERO_CUOTA = ccv.NUMERO_CUOTA
      )
    `;

    if (!pendingWhere) {
      return `WHERE ${notExistsClause}`;
    }

    return `${pendingWhere} AND ${notExistsClause}`;
  }

  private mapRows(rows: OracleRow[]): DetalleCuotaDto[] {
    return rows.map((row) => ({
      numeroContrato: this.normalizeString(row.NUMERO_CONTRATO),
      fechaVencimiento: this.normalizeDate(row.FECHA_VENCIMIENTO),
      fechaPago: this.normalizeDate(row.FECHA_PAGO),
      numeroCuota: this.normalizeNumber(row.NUMERO_CUOTA),
      montoCuota: this.normalizeNumber(row.MONTO_CUOTA),
      cuotaCobrada:
        row.CUOTA_COBRADA === null || row.CUOTA_COBRADA === undefined
          ? null
          : this.normalizeNumber(row.CUOTA_COBRADA),
      moraCuota:
        row.MORA_CUOTA === null || row.MORA_CUOTA === undefined
          ? null
          : this.normalizeNumber(row.MORA_CUOTA),
    }));
  }

  private normalizeString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }

  private normalizeDate(value: unknown): Date | string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }

      const parsed = new Date(normalized);
      return Number.isNaN(parsed.getTime()) ? normalized : parsed;
    }

    if (typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  private normalizeNumber(value: unknown): number {
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

  private extractTotal(rows: OracleRow[]): number {
    const total = rows[0]?.TOTAL;
    return this.normalizeNumber(total);
  }

  private executeQuery(
    sql: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    return this.dataSource.query(sql, params as any);
  }

  private captureQuerySnapshot(
    label: string,
    sql: string,
    parameters: Record<string, unknown>,
  ): QueryDebugSnapshot {
    return {
      label,
      sql: this.normalizeSql(sql),
      parameters: { ...parameters },
    };
  }

  private normalizeSql(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  private omitPaginationParams(
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const { limite, offset, ...rest } = params;
    return rest;
  }

  private validateDto(dto: PaginacionDto) {
    if (
      dto.numeroCuota !== undefined &&
      (dto.numeroCuotaDesde !== undefined || dto.numeroCuotaHasta !== undefined)
    ) {
      throw new BadRequestException(
        'No puedes enviar numeroCuota junto con numeroCuotaDesde o numeroCuotaHasta',
      );
    }

    if (
      dto.numeroCuotaDesde !== undefined &&
      dto.numeroCuotaHasta !== undefined &&
      dto.numeroCuotaDesde > dto.numeroCuotaHasta
    ) {
      throw new BadRequestException(
        'numeroCuotaDesde no puede ser mayor que numeroCuotaHasta',
      );
    }
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
      `findAll detalle-cuotas lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} offset=${input.offset} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql detalle-cuotas ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }

  private rethrowKnownOracleError(error: unknown): never {
    const code = this.extractOracleErrorCode(error);
    const message = error instanceof Error ? error.message : String(error);

    if (code === 'ORA-04045' || code === 'ORA-16000') {
      this.logger.error(
        `detalle-cuotas source unavailable code=${code} message=${message}`,
      );
      throw new ServiceUnavailableException(
        'Las fuentes Oracle ADCC.CBI_CUOTAS_PAGADAS_V o ADCC.CBI_CUOTAS_V no están disponibles para detalle-cuotas. Deben corregirse o recompilarse en origen.',
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

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CuotasVencidasEntity } from './cuotas-vencidas.entity';
import { PaginacionDto, PaginacionResponseDto } from './cuotas-vencidas.dto';
import {
  CacheEntry,
  buildStableCacheKey,
  countActiveFilters,
  getCacheValue,
  measureAsync,
  parsePositiveNumber,
  setCacheValue,
} from '../common/query-performance.util';

type CursorPayload = {
  mm: number;
  fv: string;
  nc: string;
  nq: number;
};

type CuotasVencidasRow = CuotasVencidasEntity;
type CuotasVencidasResponse = PaginacionResponseDto<CuotasVencidasEntity>;
type QueryDebugSnapshot = {
  label: string;
  sql: string;
  parameters: unknown[];
};

@Injectable()
export class CuotasVencidasService {
  private static readonly NULL_DATE_CURSOR = '9999-12-31 23:59:59';
  private static readonly NULL_MORA_CURSOR = -1;
  private readonly logger = new Logger(CuotasVencidasService.name);
  private readonly cache = new Map<
    string,
    CacheEntry<CuotasVencidasResponse>
  >();
  private readonly inFlight = new Map<
    string,
    Promise<CuotasVencidasResponse>
  >();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly logSlowSql: boolean;

  constructor(
    @InjectRepository(CuotasVencidasEntity)
    private repo: Repository<CuotasVencidasEntity>,
    private configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('CUOTAS_VENCIDAS_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('CUOTAS_VENCIDAS_CACHE_MAX_ITEMS'),
      200,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(
    dto: PaginacionDto,
  ): Promise<CuotasVencidasResponse> {
    const startedAt = Date.now();
    const limite = Math.min(Math.max(dto.limite || 100, 1), 100000);
    const incluirTotal = dto.incluirTotal === true;
    const usarCursor = dto.cursor !== undefined || dto.offset === undefined;
    const normalizedDto: Record<string, unknown> = {
      ...dto,
      limite,
      incluirTotal,
      modoPaginacion: usarCursor ? 'cursor' : 'offset',
    };

    if (!usarCursor) {
      normalizedDto.offset = Math.max(dto.offset || 0, 0);
    }

    const cacheKey = buildStableCacheKey(normalizedDto);
    const cached = getCacheValue(this.cache, cacheKey);
    if (cached) {
      this.logger.debug(
        `cache hit cuotas-vencidas modo=${normalizedDto.modoPaginacion} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join cuotas-vencidas modo=${normalizedDto.modoPaginacion} incluirTotal=${incluirTotal}`,
      );
      return pending;
    }

    const activeFilters = countActiveFilters(normalizedDto, [
      'limite',
      'offset',
      'cursor',
      'incluirTotal',
      'modoPaginacion',
    ]);

    const loadPromise = (async () => {
      if (usarCursor) {
        const response = await this.findAllByCursor(
          dto,
          limite,
          incluirTotal,
          startedAt,
          activeFilters,
        );
        setCacheValue(
          this.cache,
          cacheKey,
          response,
          this.cacheTtlMs,
          this.cacheMaxItems,
        );
        return response;
      }

      const offset = Math.max(dto.offset || 0, 0);
      const response = await this.findAllByOffset(
        dto,
        limite,
        offset,
        incluirTotal,
        startedAt,
        activeFilters,
      );
      setCacheValue(
        this.cache,
        cacheKey,
        response,
        this.cacheTtlMs,
        this.cacheMaxItems,
      );
      return response;
    })();

    this.inFlight.set(cacheKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      if (this.inFlight.get(cacheKey) === loadPromise) {
        this.inFlight.delete(cacheKey);
      }
    }
  }

  private async findAllByOffset(
    dto: PaginacionDto,
    limite: number,
    offset: number,
    incluirTotal: boolean,
    startedAt: number,
    filters: number,
  ): Promise<CuotasVencidasResponse> {
    const pagina = Math.floor(offset / limite) + 1;

    const qb = this.repo.createQueryBuilder('v');
    this.applyFilters(qb, dto);
    const dataQb = this.selectDataColumns(qb.clone());

    if (!incluirTotal) {
      const pagedDataQb = this.applyOrder(dataQb).skip(offset).take(limite + 1);
      const querySnapshots = [this.captureQuery('data', pagedDataQb)];
      const dataResult = await measureAsync(() =>
        pagedDataQb.getRawMany<CuotasVencidasRow>(),
      );

      const tieneMas = dataResult.result.length > limite;
      const response: CuotasVencidasResponse = {
        data: dataResult.result.slice(0, limite),
        total: null,
        limite,
        offset,
        pagina,
        totalPaginas: null,
        incluirTotal: false,
        modoPaginacion: 'offset',
        cursorActual: null,
        nextCursor: null,
        tieneMas,
      };

      this.logSlowRequest({
        startedAt,
        dataDurationMs: dataResult.durationMs,
        countDurationMs: null,
        limite,
        incluirTotal: false,
        rows: response.data.length,
        filters,
        modoPaginacion: 'offset',
        querySnapshots,
      });

      return response;
    }

    const countQb = qb.clone();
    const pagedDataQb = this.applyOrder(this.selectDataColumns(qb.clone()))
      .skip(offset)
      .take(limite);
    const querySnapshots = [
      this.captureQuery('count', countQb),
      this.captureQuery('data', pagedDataQb),
    ];

    const [countResult, dataResult] = await Promise.all([
      measureAsync(() => countQb.getCount()),
      measureAsync(() => pagedDataQb.getRawMany<CuotasVencidasRow>()),
    ]);

    const response: CuotasVencidasResponse = {
      data: dataResult.result,
      total: countResult.result,
      limite,
      offset,
      pagina,
      totalPaginas: Math.ceil(countResult.result / limite),
      incluirTotal: true,
      modoPaginacion: 'offset',
      cursorActual: null,
      nextCursor: null,
    };

    this.logSlowRequest({
      startedAt,
      dataDurationMs: dataResult.durationMs,
      countDurationMs: countResult.durationMs,
      limite,
      incluirTotal: true,
      rows: response.data.length,
      filters,
      modoPaginacion: 'offset',
      querySnapshots,
    });

    return response;
  }

  private async findAllByCursor(
    dto: PaginacionDto,
    limite: number,
    incluirTotal: boolean,
    startedAt: number,
    filters: number,
  ): Promise<CuotasVencidasResponse> {
    const baseQb = this.repo.createQueryBuilder('v');
    this.applyFilters(baseQb, dto);

    const dataQb = this.selectDataColumns(baseQb.clone());
    if (dto.cursor) {
      const cursor = this.decodeCursor(dto.cursor);
      this.applyCursorFilter(dataQb, cursor);
    }

    const pagedDataQb = this.applyOrder(dataQb).take(limite + 1);
    const querySnapshots: QueryDebugSnapshot[] = [
      this.captureQuery('data', pagedDataQb),
    ];
    const countQb = incluirTotal ? baseQb.clone() : null;
    if (countQb) {
      querySnapshots.unshift(this.captureQuery('count', countQb));
    }

    const dataPromise = measureAsync(() =>
      pagedDataQb.getRawMany<CuotasVencidasRow>(),
    );
    const totalPromise = incluirTotal
      ? measureAsync(() => countQb!.getCount())
      : Promise.resolve(null);

    const [countResult, dataResult] = await Promise.all([totalPromise, dataPromise]);
    const tieneMas = dataResult.result.length > limite;
    const data = dataResult.result.slice(0, limite);
    const lastItem = data[data.length - 1];
    const nextCursor = tieneMas && lastItem ? this.encodeCursor(lastItem) : null;

    const response: CuotasVencidasResponse = {
      data,
      total: countResult?.result ?? null,
      limite,
      offset: null,
      pagina: null,
      totalPaginas:
        countResult?.result !== undefined
          ? Math.ceil(countResult.result / limite)
          : null,
      incluirTotal,
      modoPaginacion: 'cursor',
      cursorActual: dto.cursor ?? null,
      nextCursor,
      tieneMas,
    };

    this.logSlowRequest({
      startedAt,
      dataDurationMs: dataResult.durationMs,
      countDurationMs: countResult?.durationMs ?? null,
      limite,
      incluirTotal,
      rows: response.data.length,
      filters,
      modoPaginacion: 'cursor',
      querySnapshots,
    });

    return response;
  }

  private applyFilters(
    qb: SelectQueryBuilder<CuotasVencidasEntity>,
    dto: PaginacionDto,
  ) {
    if (
      dto.mesesMoraHasta !== undefined &&
      dto.mesesMoraHastaExclusivo !== undefined
    ) {
      throw new BadRequestException(
        'No puedes enviar mesesMoraHasta y mesesMoraHastaExclusivo al mismo tiempo',
      );
    }

    const fechaVencimientoDesde =
      dto.fechaVencimientoDesde ?? dto.fechaDesde;
    const fechaVencimientoHasta =
      dto.fechaVencimientoHasta ?? dto.fechaHasta;

    if (dto.numeroContrato) {
      qb.andWhere('v.numeroContrato = :numeroContrato', {
        numeroContrato: dto.numeroContrato,
      });
    }

    if (dto.documento) {
      qb.andWhere('v.documento = :documento', {
        documento: dto.documento,
      });
    }

    if (dto.idCliente) {
      qb.andWhere('v.idCliente = :idCliente', {
        idCliente: dto.idCliente,
      });
    }

    if (dto.sucursal) {
      qb.andWhere('v.sucursal = :sucursal', {
        sucursal: dto.sucursal,
      });
    }

    if (dto.estado) {
      qb.andWhere('v.estado = :estado', {
        estado: dto.estado,
      });
    }

    if (dto.estadoContrato) {
      qb.andWhere('v.estadoContrato = :estadoContrato', {
        estadoContrato: dto.estadoContrato,
      });
    }

    if (dto.estadoCuota) {
      qb.andWhere('v.estadoCuota = :estadoCuota', {
        estadoCuota: dto.estadoCuota,
      });
    }

    if (dto.vendedor) {
      qb.andWhere('v.vendedor = :vendedor', {
        vendedor: dto.vendedor,
      });
    }

    if (dto.mesesMoraDesde !== undefined) {
      qb.andWhere('v.mesesMora >= :mesesMoraDesde', {
        mesesMoraDesde: dto.mesesMoraDesde,
      });
    }

    if (dto.mesesMoraHasta !== undefined) {
      qb.andWhere('v.mesesMora <= :mesesMoraHasta', {
        mesesMoraHasta: dto.mesesMoraHasta,
      });
    }

    if (dto.mesesMoraHastaExclusivo !== undefined) {
      qb.andWhere('v.mesesMora < :mesesMoraHastaExclusivo', {
        mesesMoraHastaExclusivo: dto.mesesMoraHastaExclusivo,
      });
    }

    if (fechaVencimientoDesde) {
      qb.andWhere(
        "v.fechaVencimiento >= TO_DATE(:fechaVencimientoDesde, 'YYYY-MM-DD')",
        { fechaVencimientoDesde },
      );
    }

    if (fechaVencimientoHasta) {
      qb.andWhere(
        "v.fechaVencimiento <= TO_DATE(:fechaVencimientoHasta, 'YYYY-MM-DD')",
        { fechaVencimientoHasta },
      );
    }

    if (dto.ultimoPagoDesde) {
      qb.andWhere(
        "v.ultimoPago >= TO_DATE(:ultimoPagoDesde, 'YYYY-MM-DD')",
        { ultimoPagoDesde: dto.ultimoPagoDesde },
      );
    }

    if (dto.ultimoPagoHasta) {
      qb.andWhere(
        "v.ultimoPago <= TO_DATE(:ultimoPagoHasta, 'YYYY-MM-DD')",
        { ultimoPagoHasta: dto.ultimoPagoHasta },
      );
    }
  }

  private applyOrder(qb: SelectQueryBuilder<CuotasVencidasEntity>) {
    return qb
      .orderBy('v.mesesMora', 'DESC', 'NULLS LAST')
      .addOrderBy('v.fechaVencimiento', 'ASC', 'NULLS LAST')
      .addOrderBy('v.numeroContrato', 'ASC')
      .addOrderBy('v.numeroCuota', 'ASC');
  }

  private selectDataColumns(qb: SelectQueryBuilder<CuotasVencidasEntity>) {
    return qb
      .select('v.idFraccion', 'idFraccion')
      .addSelect('v.nombreFraccion', 'nombreFraccion')
      .addSelect('v.idManzana', 'idManzana')
      .addSelect('v.idLote', 'idLote')
      .addSelect('v.numeroContrato', 'numeroContrato')
      .addSelect('v.fecContrato', 'fecContrato')
      .addSelect('v.fecTrato', 'fecTrato')
      .addSelect('v.sucursal', 'sucursal')
      .addSelect('v.nombreParaDocumento', 'nombreParaDocumento')
      .addSelect('v.idCliente', 'idCliente')
      .addSelect('v.documento', 'documento')
      .addSelect('v.numeroCuota', 'numeroCuota')
      .addSelect('v.estado', 'estado')
      .addSelect('v.montoCuota', 'montoCuota')
      .addSelect('v.plazo', 'plazo')
      .addSelect('v.moraCuota', 'moraCuota')
      .addSelect('v.fechaVencimiento', 'fechaVencimiento')
      .addSelect('v.mesesMora', 'mesesMora')
      .addSelect('v.ultimoPago', 'ultimoPago')
      .addSelect('v.saldoVencido', 'saldoVencido')
      .addSelect('v.telefonoCelular', 'telefonoCelular')
      .addSelect('v.estadoContrato', 'estadoContrato')
      .addSelect('v.vendedor', 'vendedor')
      .addSelect('v.estadoCuota', 'estadoCuota');
  }

  private applyCursorFilter(
    qb: SelectQueryBuilder<CuotasVencidasEntity>,
    cursor: CursorPayload,
  ) {
    const moraExpr = 'NVL(v.mesesMora, -1)';
    const fechaExpr = "NVL(v.fechaVencimiento, DATE '9999-12-31')";

    qb.andWhere(
      `(
        ${moraExpr} < :cursorMesesMora
        OR (
          ${moraExpr} = :cursorMesesMora
          AND ${fechaExpr} > TO_DATE(:cursorFechaVencimiento, 'YYYY-MM-DD HH24:MI:SS')
        )
        OR (
          ${moraExpr} = :cursorMesesMora
          AND
          ${fechaExpr} = TO_DATE(:cursorFechaVencimiento, 'YYYY-MM-DD HH24:MI:SS')
          AND v.numeroContrato > :cursorNumeroContrato
        )
        OR (
          ${moraExpr} = :cursorMesesMora
          AND ${fechaExpr} = TO_DATE(:cursorFechaVencimiento, 'YYYY-MM-DD HH24:MI:SS')
          AND v.numeroContrato = :cursorNumeroContrato
          AND v.numeroCuota > :cursorNumeroCuota
        )
      )`,
      {
        cursorMesesMora: cursor.mm,
        cursorFechaVencimiento: cursor.fv,
        cursorNumeroContrato: cursor.nc,
        cursorNumeroCuota: cursor.nq,
      },
    );
  }

  private encodeCursor(item: CuotasVencidasRow): string {
    const payload: CursorPayload = {
      mm: this.formatCursorMora(item.mesesMora),
      fv: this.formatCursorDate(item.fechaVencimiento),
      nc: item.numeroContrato ?? '',
      nq: Number(item.numeroCuota ?? 0),
    };

    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): CursorPayload {
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as Partial<CursorPayload>;

      if (
        typeof parsed.mm !== 'number' ||
        typeof parsed.fv !== 'string' ||
        typeof parsed.nc !== 'string' ||
        typeof parsed.nq !== 'number'
      ) {
        throw new Error('Cursor incompleto');
      }

      return {
        mm: parsed.mm,
        fv: parsed.fv,
        nc: parsed.nc,
        nq: parsed.nq,
      };
    } catch {
      throw new BadRequestException('Cursor inválido');
    }
  }

  private formatCursorDate(value?: Date | string | null): string {
    if (!value) {
      return CuotasVencidasService.NULL_DATE_CURSOR;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('No se pudo construir el cursor de fecha');
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    const seconds = `${date.getSeconds()}`.padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private formatCursorMora(value?: number | string | null): number {
    if (value === null || value === undefined || value === '') {
      return CuotasVencidasService.NULL_MORA_CURSOR;
    }

    const mora = Number(value);
    if (Number.isNaN(mora)) {
      throw new BadRequestException('No se pudo construir el cursor de mesesMora');
    }

    return mora;
  }

  private logSlowRequest(input: {
    startedAt: number;
    dataDurationMs: number;
    countDurationMs: number | null;
    limite: number;
    incluirTotal: boolean;
    rows: number;
    filters: number;
    modoPaginacion: 'cursor' | 'offset';
    querySnapshots?: QueryDebugSnapshot[];
  }) {
    const totalDurationMs = Date.now() - input.startedAt;
    const isFast =
      totalDurationMs < 1000 &&
      input.dataDurationMs < 1000 &&
      (input.countDurationMs === null || input.countDurationMs < 1000);

    if (isFast) {
      return;
    }

    this.logger.warn(
      `findAll cuotas-vencidas lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters} modo=${input.modoPaginacion}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql cuotas-vencidas ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }

  private captureQuery(
    label: string,
    qb: SelectQueryBuilder<CuotasVencidasEntity>,
  ): QueryDebugSnapshot {
    const [sql, parameters] = qb.getQueryAndParameters();
    return {
      label,
      sql: sql.replace(/\s+/g, ' ').trim(),
      parameters,
    };
  }
}


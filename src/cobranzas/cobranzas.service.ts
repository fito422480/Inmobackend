import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
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
  withOracleFirstRowsHint,
} from '../common/query-performance.util';
import { PaginacionDto, PaginacionResponseDto } from './cobranzas.dto';
import { CobranzasEntity } from './cobranzas.entity';

type CursorPayload = {
  ma: number | null;
  v: string | null;
  c: string;
  q: number;
};

type CobranzasRow = CobranzasEntity;
type CobranzasResponse = PaginacionResponseDto<CobranzasEntity>;

@Injectable()
export class CobranzasService {
  private static readonly NULL_DATE_CURSOR = '9999-12-31 23:59:59';
  private static readonly NULL_MESES_ATRASO_CURSOR = -1;
  private static readonly DEFAULT_MESES_ATRASO = 0;
  private static readonly ESTADOS_COBRANZAS = ['Activo', 'Bloqueado'];
  private readonly logger = new Logger(CobranzasService.name);
  private readonly cache = new Map<string, CacheEntry<CobranzasResponse>>();
  private readonly inFlight = new Map<string, Promise<CobranzasResponse>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly logSlowSql: boolean;

  constructor(
    @InjectRepository(CobranzasEntity)
    private repo: Repository<CobranzasEntity>,
    private configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('COBRANZAS_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('COBRANZAS_CACHE_MAX_ITEMS'),
      200,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(dto: PaginacionDto): Promise<CobranzasResponse> {
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
        `cache hit cobranzas modo=${normalizedDto.modoPaginacion} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join cobranzas modo=${normalizedDto.modoPaginacion} incluirTotal=${incluirTotal}`,
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
  ): Promise<CobranzasResponse> {
    const pagina = Math.floor(offset / limite) + 1;

    const qb = this.repo.createQueryBuilder('v');
    this.applyFilters(qb, dto);
    const dataQb = this.selectDataColumns(qb.clone(), limite + 1);

    if (!incluirTotal) {
      const pagedDataQb = this.applyOrder(dataQb).skip(offset).take(limite + 1);
      const querySnapshots = [
        captureQuerySnapshot('data', pagedDataQb),
      ] as QueryDebugSnapshot[];
      const dataResult = await measureAsync(() =>
        pagedDataQb.getRawMany<CobranzasRow>(),
      );

      const tieneMas = dataResult.result.length > limite;
      const response: CobranzasResponse = {
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
      const pagedDataQb = this.applyOrder(
        this.selectDataColumns(qb.clone(), limite),
      )
      .skip(offset)
      .take(limite);
    const querySnapshots = [
      captureQuerySnapshot('count', countQb),
      captureQuerySnapshot('data', pagedDataQb),
    ] as QueryDebugSnapshot[];

    const [countResult, dataResult] = await Promise.all([
      measureAsync(() => countQb.getCount()),
      measureAsync(() => pagedDataQb.getRawMany<CobranzasRow>()),
    ]);

    const response: CobranzasResponse = {
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
  ): Promise<CobranzasResponse> {
    const baseQb = this.repo.createQueryBuilder('v');
    this.applyFilters(baseQb, dto);

    const dataQb = this.selectDataColumns(baseQb.clone(), limite + 1);
    if (dto.cursor) {
      const cursor = this.decodeCursor(dto.cursor);
      this.applyCursorFilter(dataQb, cursor);
    }

    const pagedDataQb = this.applyOrder(dataQb).take(limite + 1);
    const querySnapshots = [
      captureQuerySnapshot('data', pagedDataQb),
    ] as QueryDebugSnapshot[];
    const countQb = incluirTotal ? baseQb.clone() : null;
    if (countQb) {
      querySnapshots.unshift(captureQuerySnapshot('count', countQb));
    }

    const dataPromise = measureAsync(() =>
      pagedDataQb.getRawMany<CobranzasRow>(),
    );
    const totalPromise = incluirTotal
      ? measureAsync(() => countQb!.getCount())
      : Promise.resolve(null);

    const [countResult, dataResult] = await Promise.all([
      totalPromise,
      dataPromise,
    ]);
    const tieneMas = dataResult.result.length > limite;
    const data = dataResult.result.slice(0, limite);
    const lastItem = data[data.length - 1];
    const nextCursor =
      tieneMas && lastItem ? this.encodeCursor(lastItem) : null;

    const response: CobranzasResponse = {
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
    qb: SelectQueryBuilder<CobranzasEntity>,
    dto: PaginacionDto,
  ) {
    if (
      dto.mesesAtraso !== undefined &&
      (dto.mesesAtrasoDesde !== undefined || dto.mesesAtrasoHasta !== undefined)
    ) {
      throw new BadRequestException(
        'No puedes enviar mesesAtraso junto con mesesAtrasoDesde o mesesAtrasoHasta',
      );
    }

    if (
      dto.mesesAtrasoDesde !== undefined &&
      dto.mesesAtrasoHasta !== undefined &&
      dto.mesesAtrasoDesde > dto.mesesAtrasoHasta
    ) {
      throw new BadRequestException(
        'mesesAtrasoDesde no puede ser mayor que mesesAtrasoHasta',
      );
    }

    qb.andWhere('v.estado IN (:...estadosCobranzas)', {
      estadosCobranzas: CobranzasService.ESTADOS_COBRANZAS,
    });

    if (dto.estado) {
      qb.andWhere('v.estado = :estado', {
        estado: dto.estado,
      });
    }

    if (dto.mesesAtraso !== undefined) {
      qb.andWhere('v.mesesAtraso = :mesesAtraso', {
        mesesAtraso: dto.mesesAtraso,
      });
      return;
    }

    if (
      dto.mesesAtrasoDesde === undefined &&
      dto.mesesAtrasoHasta === undefined
    ) {
      qb.andWhere('v.mesesAtraso = :defaultMesesAtraso', {
        defaultMesesAtraso: CobranzasService.DEFAULT_MESES_ATRASO,
      });
      return;
    }

    if (dto.mesesAtrasoDesde !== undefined) {
      qb.andWhere('v.mesesAtraso >= :mesesAtrasoDesde', {
        mesesAtrasoDesde: dto.mesesAtrasoDesde,
      });
    }

    if (dto.mesesAtrasoHasta !== undefined) {
      qb.andWhere('v.mesesAtraso <= :mesesAtrasoHasta', {
        mesesAtrasoHasta: dto.mesesAtrasoHasta,
      });
    }
  }

  private applyOrder(qb: SelectQueryBuilder<CobranzasEntity>) {
    return qb
      .orderBy('v.mesesAtraso', 'DESC', 'NULLS LAST')
      .addOrderBy('v.vencimiento', 'ASC', 'NULLS LAST')
      .addOrderBy('v.contrato', 'ASC')
      .addOrderBy('v.cuota', 'ASC');
  }

  private selectDataColumns(
    qb: SelectQueryBuilder<CobranzasEntity>,
    firstRowsHint?: number,
  ) {
    return qb
      .select(
        withOracleFirstRowsHint('v.contrato', firstRowsHint),
        'contrato',
      )
      .addSelect('v.fecContrato', 'fecContrato')
      .addSelect('v.titular', 'titular')
      .addSelect('v.ciRuc', 'ciRuc')
      .addSelect('v.telefono', 'telefono')
      .addSelect('v.sucursal', 'sucursal')
      .addSelect('v.fraccion', 'fraccion')
      .addSelect('v.manzana', 'manzana')
      .addSelect('v.lote', 'lote')
      .addSelect('v.padron', 'padron')
      .addSelect('v.vencimiento', 'vencimiento')
      .addSelect('v.cuota', 'cuota')
      .addSelect('v.importeCuota', 'importeCuota')
      .addSelect('v.plazo', 'plazo')
      .addSelect('v.ultimoPago', 'ultimoPago')
      .addSelect('v.fechaSenia', 'fechaSenia')
      .addSelect('v.mesesAtraso', 'mesesAtraso')
      .addSelect('v.saldoVencido', 'saldoVencido')
      .addSelect('v.interes', 'interes')
      .addSelect('v.estado', 'estado');
  }

  private applyCursorFilter(
    qb: SelectQueryBuilder<CobranzasEntity>,
    cursor: CursorPayload,
  ) {
    const tieBreakerCondition = `(
      v.contrato > :cursorContrato
      OR (
        v.contrato = :cursorContrato
        AND v.cuota > :cursorCuota
      )
    )`;

    if (cursor.ma === null) {
      if (cursor.v === null) {
        qb.andWhere(
          `(
            v.mesesAtraso IS NULL
            AND v.vencimiento IS NULL
            AND ${tieBreakerCondition}
          )`,
          {
            cursorContrato: cursor.c,
            cursorCuota: cursor.q,
          },
        );
        return;
      }

      qb.andWhere(
        `(
          v.mesesAtraso IS NULL
          AND (
            v.vencimiento > TO_DATE(:cursorVencimiento, 'YYYY-MM-DD HH24:MI:SS')
            OR v.vencimiento IS NULL
            OR (
              v.vencimiento = TO_DATE(:cursorVencimiento, 'YYYY-MM-DD HH24:MI:SS')
              AND ${tieBreakerCondition}
            )
          )
        )`,
        {
          cursorVencimiento: cursor.v,
          cursorContrato: cursor.c,
          cursorCuota: cursor.q,
        },
      );
      return;
    }

    if (cursor.v === null) {
      qb.andWhere(
        `(
          v.mesesAtraso < :cursorMesesAtraso
          OR v.mesesAtraso IS NULL
          OR (
            v.mesesAtraso = :cursorMesesAtraso
            AND v.vencimiento IS NULL
            AND ${tieBreakerCondition}
          )
        )`,
        {
          cursorMesesAtraso: cursor.ma,
          cursorContrato: cursor.c,
          cursorCuota: cursor.q,
        },
      );
      return;
    }

    qb.andWhere(
      `(
        v.mesesAtraso < :cursorMesesAtraso
        OR v.mesesAtraso IS NULL
        OR (
          v.mesesAtraso = :cursorMesesAtraso
          AND (
            v.vencimiento > TO_DATE(:cursorVencimiento, 'YYYY-MM-DD HH24:MI:SS')
            OR v.vencimiento IS NULL
            OR (
              v.vencimiento = TO_DATE(:cursorVencimiento, 'YYYY-MM-DD HH24:MI:SS')
              AND ${tieBreakerCondition}
            )
          )
        )
      )`,
      {
        cursorMesesAtraso: cursor.ma,
        cursorVencimiento: cursor.v,
        cursorContrato: cursor.c,
        cursorCuota: cursor.q,
      },
    );
  }

  private encodeCursor(item: CobranzasRow): string {
    const payload: CursorPayload = {
      ma: this.formatCursorMesesAtraso(item.mesesAtraso),
      v: this.formatCursorDate(item.vencimiento),
      c: item.contrato ?? '',
      q: Number(item.cuota ?? 0),
    };

    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): CursorPayload {
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as Partial<CursorPayload>;

      const mesesAtraso = this.parseCursorMesesAtraso(parsed.ma);
      const vencimiento = this.parseCursorDate(parsed.v);

      if (
        typeof parsed.c !== 'string' ||
        typeof parsed.q !== 'number'
      ) {
        throw new Error('Cursor incompleto');
      }

      return {
        ma: mesesAtraso,
        v: vencimiento,
        c: parsed.c,
        q: parsed.q,
      };
    } catch {
      throw new BadRequestException('Cursor inválido');
    }
  }

  private formatCursorDate(value?: Date | string | null): string | null {
    if (!value) {
      return null;
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

  private formatCursorMesesAtraso(value?: number | string | null): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const mesesAtraso = Number(value);
    if (Number.isNaN(mesesAtraso)) {
      throw new BadRequestException(
        'No se pudo construir el cursor de mesesAtraso',
      );
    }

    return mesesAtraso;
  }

  private parseCursorDate(value: unknown): string | null {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new Error('Cursor de fecha inválido');
    }

    return value === CobranzasService.NULL_DATE_CURSOR ? null : value;
  }

  private parseCursorMesesAtraso(value: unknown): number | null {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'number') {
      throw new Error('Cursor de mesesAtraso inválido');
    }

    return value === CobranzasService.NULL_MESES_ATRASO_CURSOR ? null : value;
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
      `findAll cobranzas lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters} modo=${input.modoPaginacion}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql cobranzas ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }
}

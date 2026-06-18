import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  buildStableCacheKey,
  CacheEntry,
  captureQuerySnapshot,
  countActiveFilters,
  getCacheValue,
  measureAsync,
  parsePositiveNumber,
  QueryDebugSnapshot,
  setCacheValue,
  withOracleFirstRowsHint,
} from '../common/query-performance.util';
import {
  FraccionesItemDto,
  FraccionesQueryDto,
  FraccionesResponseDto,
} from './fracciones.dto';
import { FraccionesEntity } from './fracciones.entity';

type FraccionesResponse = FraccionesResponseDto<FraccionesItemDto>;
type FraccionesRawRow = {
  ciudad: string;
  fraccion: string;
  disponibles: string | number;
};

@Injectable()
export class FraccionesService {
  private readonly logger = new Logger(FraccionesService.name);
  private readonly cache = new Map<string, CacheEntry<FraccionesResponse>>();
  private readonly inFlight = new Map<string, Promise<FraccionesResponse>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly logSlowSql: boolean;

  constructor(
    @InjectRepository(FraccionesEntity)
    private readonly repo: Repository<FraccionesEntity>,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('FRACCIONES_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('FRACCIONES_CACHE_MAX_ITEMS'),
      200,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(dto: FraccionesQueryDto): Promise<FraccionesResponse> {
    const startedAt = Date.now();
    const limite = Math.min(Math.max(dto.limite || 100, 1), 1000);
    const offset = Math.max(dto.offset || 0, 0);
    const incluirTotal = dto.incluirTotal === true;
    const pagina = Math.floor(offset / limite) + 1;
    const normalizedDto: FraccionesQueryDto = {
      ...dto,
      limite,
      offset,
      incluirTotal,
    };
    const normalizedRecord = normalizedDto as unknown as Record<
      string,
      unknown
    >;

    const cacheKey = buildStableCacheKey(normalizedRecord);
    const cached = getCacheValue(this.cache, cacheKey);
    if (cached) {
      this.logger.debug(
        `cache hit fracciones limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join fracciones limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return pending;
    }

    const loadPromise = (async () => {
      const baseQb = this.repo.createQueryBuilder('v');
      this.applyBaseFilters(baseQb);

      if (!incluirTotal) {
        const dataQb = this.buildDataQuery(baseQb.clone(), limite + 1)
          .skip(offset)
          .take(limite + 1);
        const querySnapshots = [
          captureQuerySnapshot('data', dataQb),
        ] as QueryDebugSnapshot[];
        const dataResult = await measureAsync(() =>
          dataQb.getRawMany<FraccionesRawRow>(),
        );

        const tieneMas = dataResult.result.length > limite;
        const response: FraccionesResponse = {
          data: this.mapRows(dataResult.result.slice(0, limite)),
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
          filters: countActiveFilters(normalizedRecord, [
            'limite',
            'offset',
            'incluirTotal',
          ]),
          querySnapshots,
        });

        return response;
      }

      const countQb = baseQb.clone();
      const dataQb = this.buildDataQuery(baseQb.clone(), limite)
        .skip(offset)
        .take(limite);
      const querySnapshots = [
        captureQuerySnapshot('count', countQb),
        captureQuerySnapshot('data', dataQb),
      ] as QueryDebugSnapshot[];

      const [countResult, dataResult] = await Promise.all([
        measureAsync(() => countQb.getCount()),
        measureAsync(() => dataQb.getRawMany<FraccionesRawRow>()),
      ]);

      const response: FraccionesResponse = {
        data: this.mapRows(dataResult.result),
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
        filters: countActiveFilters(normalizedRecord, [
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
    } finally {
      if (this.inFlight.get(cacheKey) === loadPromise) {
        this.inFlight.delete(cacheKey);
      }
    }
  }

  private applyBaseFilters(qb: SelectQueryBuilder<FraccionesEntity>) {
    qb.where('v.disponibles > 0').andWhere('v.estado = :estado', {
      estado: 'ACTIVO',
    });
  }

  private buildDataQuery(
    qb: SelectQueryBuilder<FraccionesEntity>,
    firstRowsHint?: number,
  ) {
    return qb
      .select(
        withOracleFirstRowsHint('UPPER(v.ciudad)', firstRowsHint),
        'ciudad',
      )
      .addSelect('UPPER(v.nombreFraccion)', 'fraccion')
      .addSelect('v.disponibles', 'disponibles')
      .orderBy('UPPER(v.ciudad)', 'ASC')
      .addOrderBy('UPPER(v.nombreFraccion)', 'ASC');
  }

  private mapRows(rows: FraccionesRawRow[]): FraccionesItemDto[] {
    return rows.map((row) => ({
      ciudad: row.ciudad,
      fraccion: row.fraccion,
      disponibles: this.normalizeNumber(row.disponibles),
    }));
  }

  private normalizeNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim().replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
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
      `findAll fracciones lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} offset=${input.offset} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql fracciones ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
} from '../common/query-performance.util';
import {
  TotalPagadoMesItemDto,
  TotalPagadoMesQueryDto,
  TotalPagadoMesResponseDto,
} from './total-pagado-mes.dto';
import { TotalPagadoMesEntity } from './total-pagado-mes.entity';

type TotalPagadoMesResponse = TotalPagadoMesResponseDto<TotalPagadoMesItemDto>;

type TotalPagadoMesRawRow = {
  anio: string | number;
  mes: string | number;
  totalPagado: string | number;
  totalPagadoReal: string | number;
  notaCredito: string | number;
  totalInteres: string | number;
};

@Injectable()
export class TotalPagadoMesService {
  private readonly logger = new Logger(TotalPagadoMesService.name);
  private readonly cache = new Map<
    string,
    CacheEntry<TotalPagadoMesResponse>
  >();
  private readonly inFlight = new Map<string, Promise<TotalPagadoMesResponse>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly logSlowSql: boolean;

  constructor(
    @InjectRepository(TotalPagadoMesEntity)
    private readonly repo: Repository<TotalPagadoMesEntity>,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('TOTAL_PAGADO_MES_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('TOTAL_PAGADO_MES_CACHE_MAX_ITEMS'),
      200,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(dto: TotalPagadoMesQueryDto): Promise<TotalPagadoMesResponse> {
    const startedAt = Date.now();
    const limite = Math.min(Math.max(dto.limite || 100, 1), 1000);
    const offset = Math.max(dto.offset || 0, 0);
    const incluirTotal = dto.incluirTotal === true;
    const pagina = Math.floor(offset / limite) + 1;
    const normalizedDto: TotalPagadoMesQueryDto = {
      ...dto,
      limite,
      offset,
      incluirTotal,
      numeroCuotaMinima: dto.numeroCuotaMinima ?? 1,
    };
    const normalizedRecord = normalizedDto as unknown as Record<
      string,
      unknown
    >;

    this.validateDto(normalizedDto);

    const cacheKey = buildStableCacheKey(normalizedRecord);
    const cached = getCacheValue(this.cache, cacheKey);
    if (cached) {
      this.logger.debug(
        `cache hit total-pagado-mes limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join total-pagado-mes limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return pending;
    }

    const loadPromise = (async () => {
      const baseQb = this.repo.createQueryBuilder('v');
      this.applyFilters(baseQb, normalizedDto);

      if (!incluirTotal) {
        const dataQb = this.buildSummaryQuery(baseQb.clone())
          .skip(offset)
          .take(limite + 1);
        const querySnapshots = [
          captureQuerySnapshot('data', dataQb),
        ] as QueryDebugSnapshot[];
        const dataResult = await measureAsync(() =>
          dataQb.getRawMany<TotalPagadoMesRawRow>(),
        );

        const tieneMas = dataResult.result.length > limite;
        const response: TotalPagadoMesResponse = {
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

      const countQb = baseQb
        .clone()
        .select(
          "COUNT(DISTINCT TO_CHAR(TRUNC(v.fechaPago, 'MM'), 'YYYY-MM'))",
          'total',
        );
      const dataQb = this.buildSummaryQuery(baseQb.clone())
        .skip(offset)
        .take(limite);
      const querySnapshots = [
        captureQuerySnapshot('count', countQb),
        captureQuerySnapshot('data', dataQb),
      ] as QueryDebugSnapshot[];

      const [countResult, dataResult] = await Promise.all([
        measureAsync(() => countQb.getRawOne<{ total: string | number }>()),
        measureAsync(() => dataQb.getRawMany<TotalPagadoMesRawRow>()),
      ]);

      const total = this.normalizeNumber(
        countResult.result?.total ?? (countResult.result as any)?.TOTAL,
      );
      const response: TotalPagadoMesResponse = {
        data: this.mapRows(dataResult.result),
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
    } catch (error) {
      this.rethrowKnownOracleError(error);
    } finally {
      if (this.inFlight.get(cacheKey) === loadPromise) {
        this.inFlight.delete(cacheKey);
      }
    }
  }

  private applyFilters(
    qb: SelectQueryBuilder<TotalPagadoMesEntity>,
    dto: TotalPagadoMesQueryDto,
  ) {
    qb.where('v.numeroCuota > :numeroCuotaMinima', {
      numeroCuotaMinima: dto.numeroCuotaMinima ?? 1,
    });

    if (dto.fechaDesde) {
      qb.andWhere("v.fechaPago >= TO_DATE(:fechaDesde, 'YYYY-MM-DD')", {
        fechaDesde: dto.fechaDesde,
      });
    }

    if (dto.fechaHasta) {
      qb.andWhere("v.fechaPago < TO_DATE(:fechaHasta, 'YYYY-MM-DD') + 1", {
        fechaHasta: dto.fechaHasta,
      });
    }
  }

  private buildSummaryQuery(
    qb: SelectQueryBuilder<TotalPagadoMesEntity>,
  ) {
    return qb
      .select('EXTRACT(YEAR FROM v.fechaPago)', 'anio')
      .addSelect('EXTRACT(MONTH FROM v.fechaPago)', 'mes')
      .addSelect('CEIL(SUM(NVL(v.cuotaCobrada, 0)))', 'totalPagado')
      .addSelect(
        'CEIL(SUM(NVL(v.montoCuota, 0) - NVL(v.notaCred, 0)))',
        'totalPagadoReal',
      )
      .addSelect('CEIL(SUM(NVL(v.notaCred, 0)))', 'notaCredito')
      .addSelect('CEIL(SUM(NVL(v.interesCobrado, 0)))', 'totalInteres')
      .groupBy('EXTRACT(YEAR FROM v.fechaPago)')
      .addGroupBy('EXTRACT(MONTH FROM v.fechaPago)')
      .orderBy('EXTRACT(YEAR FROM v.fechaPago)', 'ASC')
      .addOrderBy('EXTRACT(MONTH FROM v.fechaPago)', 'ASC');
  }

  private mapRows(rows: TotalPagadoMesRawRow[]): TotalPagadoMesItemDto[] {
    return rows.map((row) => ({
      anio: this.normalizeNumber(row.anio),
      mes: this.normalizeNumber(row.mes),
      totalPagado: this.normalizeNumber(row.totalPagado),
      totalPagadoReal: this.normalizeNumber(row.totalPagadoReal),
      notaCredito: this.normalizeNumber(row.notaCredito),
      totalInteres: this.normalizeNumber(row.totalInteres),
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
      const normalized = value.trim().replace(',', '.');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private validateDto(dto: TotalPagadoMesQueryDto) {
    if (dto.numeroCuotaMinima !== undefined && dto.numeroCuotaMinima < 0) {
      throw new BadRequestException(
        'numeroCuotaMinima no puede ser menor que 0',
      );
    }

    this.validateDateRange(
      dto.fechaDesde,
      dto.fechaHasta,
      'fechaDesde',
      'fechaHasta',
    );
  }

  private validateDateRange(
    desde: string | undefined,
    hasta: string | undefined,
    desdeName: string,
    hastaName: string,
  ) {
    if (!desde && !hasta) {
      return;
    }

    const desdeDate = desde ? this.parseDateValue(desde, desdeName) : null;
    const hastaDate = hasta ? this.parseDateValue(hasta, hastaName) : null;

    if (desdeDate && hastaDate && desdeDate > hastaDate) {
      throw new BadRequestException(
        `${desdeName} no puede ser mayor que ${hastaName}`,
      );
    }
  }

  private parseDateValue(value: string, fieldName: string): number {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new BadRequestException(
        `${fieldName} debe tener formato YYYY-MM-DD`,
      );
    }

    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException(
        `${fieldName} debe tener una fecha valida en formato YYYY-MM-DD`,
      );
    }

    return parsed.getTime();
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
      `findAll total-pagado-mes lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} offset=${input.offset} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql total-pagado-mes ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }

  private rethrowKnownOracleError(error: unknown): never {
    const code = this.extractOracleErrorCode(error);
    const message = error instanceof Error ? error.message : String(error);

    if (code === 'ORA-04045' || code === 'ORA-16000') {
      this.logger.error(
        `total-pagado-mes source unavailable code=${code} message=${message}`,
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

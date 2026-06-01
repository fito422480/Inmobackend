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
  PagoPorFranjaItemDto,
  PagosPorFranjaQueryDto,
  PagosPorFranjaResponseDto,
} from './pagos-por-franja.dto';

type PagosPorFranjaResponse =
  PagosPorFranjaResponseDto<PagoPorFranjaItemDto>;

type OracleRow = {
  MESES_MORA?: unknown;
  FECHA?: unknown;
  MES?: unknown;
  DIA?: unknown;
  TOTAL_PAGADO?: unknown;
  TOTAL_PAGADO_REAL?: unknown;
  NOTA_CREDITO?: unknown;
  TOTAL_INTERES?: unknown;
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
export class PagosPorFranjaService {
  private static readonly DEFAULT_MAX_LIMIT = 5000;
  private readonly logger = new Logger(PagosPorFranjaService.name);
  private readonly cache = new Map<string, CacheEntry<PagosPorFranjaResponse>>();
  private readonly inFlight = new Map<string, Promise<PagosPorFranjaResponse>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly maxLimit: number;
  private readonly logSlowSql: boolean;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('PAGOS_POR_FRANJA_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('PAGOS_POR_FRANJA_CACHE_MAX_ITEMS'),
      200,
    );
    this.maxLimit = parsePositiveNumber(
      this.configService.get('PAGOS_POR_FRANJA_MAX_LIMIT'),
      PagosPorFranjaService.DEFAULT_MAX_LIMIT,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(
    dto: PagosPorFranjaQueryDto,
  ): Promise<PagosPorFranjaResponse> {
    this.validateDto(dto);

    const startedAt = Date.now();
    const limite = Math.min(Math.max(dto.limite || 100, 1), this.maxLimit);
    const offset = Math.max(dto.offset || 0, 0);
    const incluirTotal = dto.incluirTotal === true;
    const pagina = Math.floor(offset / limite) + 1;
    const normalizedDto: PagosPorFranjaQueryDto = {
      ...dto,
      limite,
      offset,
      incluirTotal,
      numeroCuotaMinima: dto.numeroCuotaMinima ?? 1,
    };
    const normalizedDtoRecord = normalizedDto as unknown as Record<
      string,
      unknown
    >;

    const cacheKey = buildStableCacheKey(normalizedDtoRecord);
    const cached = getCacheValue(this.cache, cacheKey);
    if (cached) {
      this.logger.debug(
        `cache hit pagos-por-franja limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join pagos-por-franja limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
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
        const response: PagosPorFranjaResponse = {
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
      const response: PagosPorFranjaResponse = {
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
    dto: PagosPorFranjaQueryDto,
    limite: number,
    offset: number,
  ): QueryBundle {
    const params: Record<string, unknown> = {
      limite,
      offset,
      numeroCuotaMinima: dto.numeroCuotaMinima ?? 1,
    };
    const whereSql = this.buildWhere(dto, params);
    const summarySql = `
      SELECT
        MESES_MORA,
        TO_CHAR(TRUNC(FECHA_PAGO), 'YYYY-MM-DD') AS FECHA,
        EXTRACT(MONTH FROM FECHA_PAGO) AS MES,
        EXTRACT(DAY FROM FECHA_PAGO) AS DIA,
        CEIL(SUM(CUOTA_COBRADA)) AS TOTAL_PAGADO,
        CEIL(SUM(MONTO_CUOTA - NOTA_CRED)) AS TOTAL_PAGADO_REAL,
        CEIL(SUM(NOTA_CRED)) AS NOTA_CREDITO,
        CEIL(SUM(INTERES_COBRADO)) AS TOTAL_INTERES
      FROM ADCC.CBI_CUOTAS_PAGADAS_V
      ${whereSql}
      GROUP BY
        MESES_MORA,
        TRUNC(FECHA_PAGO),
        EXTRACT(MONTH FROM FECHA_PAGO),
        EXTRACT(DAY FROM FECHA_PAGO)
    `;

    const dataSql = `
      SELECT
        MESES_MORA,
        FECHA,
        MES,
        DIA,
        TOTAL_PAGADO,
        TOTAL_PAGADO_REAL,
        NOTA_CREDITO,
        TOTAL_INTERES
      FROM (
        SELECT q.*,
               ROW_NUMBER() OVER (
                 ORDER BY
                   q.FECHA ASC,
                   q.MESES_MORA ASC NULLS FIRST
               ) AS RN
        FROM (
          ${summarySql}
        ) q
      )
      WHERE RN > :offset
        AND RN <= (:offset + :limite)
      ORDER BY
        FECHA ASC,
        MESES_MORA ASC NULLS FIRST
    `;

    const countSql = `
      SELECT COUNT(*) AS TOTAL
      FROM (
        ${summarySql}
      )
    `;

    return {
      dataSql: this.normalizeSql(dataSql),
      countSql: this.normalizeSql(countSql),
      dataParams: { ...params },
      countParams: this.omitPaginationParams(params),
    };
  }

  private buildWhere(
    dto: PagosPorFranjaQueryDto,
    params: Record<string, unknown>,
  ): string {
    const clauses: string[] = ['NUMERO_CUOTA > :numeroCuotaMinima'];

    if (dto.fechaDesde) {
      clauses.push(`FECHA_PAGO >= TO_DATE(:fechaDesde, 'YYYY-MM-DD')`);
      params.fechaDesde = dto.fechaDesde;
    }

    if (dto.fechaHasta) {
      clauses.push(`FECHA_PAGO < TO_DATE(:fechaHasta, 'YYYY-MM-DD') + 1`);
      params.fechaHasta = dto.fechaHasta;
    }

    if (dto.mesesMora !== undefined) {
      clauses.push(`MESES_MORA = :mesesMora`);
      params.mesesMora = dto.mesesMora;
    } else {
      if (dto.mesesMoraDesde !== undefined) {
        clauses.push(`MESES_MORA >= :mesesMoraDesde`);
        params.mesesMoraDesde = dto.mesesMoraDesde;
      }

      if (dto.mesesMoraHasta !== undefined) {
        clauses.push(`MESES_MORA <= :mesesMoraHasta`);
        params.mesesMoraHasta = dto.mesesMoraHasta;
      }
    }

    return `WHERE ${clauses.join(' AND ')}`;
  }

  private mapRows(rows: OracleRow[]): PagoPorFranjaItemDto[] {
    return rows.map((row) => ({
      mesesMora: this.normalizeNullableNumber(row.MESES_MORA),
      fecha: this.normalizeString(row.FECHA),
      mes: this.normalizeNullableNumber(row.MES),
      dia: this.normalizeNullableNumber(row.DIA),
      totalPagado: this.normalizeNumber(row.TOTAL_PAGADO),
      totalPagadoReal: this.normalizeNumber(row.TOTAL_PAGADO_REAL),
      notaCredito: this.normalizeNumber(row.NOTA_CREDITO),
      totalInteres: this.normalizeNumber(row.TOTAL_INTERES),
    }));
  }

  private normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
  }

  private normalizeNumber(value: unknown): number {
    return this.normalizeNullableNumber(value) ?? 0;
  }

  private normalizeNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }

      const parsed = Number(normalized.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private extractTotal(rows: OracleRow[]): number {
    return this.normalizeNumber(rows[0]?.TOTAL);
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

  private validateDto(dto: PagosPorFranjaQueryDto) {
    if (
      dto.mesesMora !== undefined &&
      (dto.mesesMoraDesde !== undefined || dto.mesesMoraHasta !== undefined)
    ) {
      throw new BadRequestException(
        'No puedes enviar mesesMora junto con mesesMoraDesde o mesesMoraHasta',
      );
    }

    if (
      dto.numeroCuotaMinima !== undefined &&
      dto.numeroCuotaMinima < 0
    ) {
      throw new BadRequestException(
        'numeroCuotaMinima no puede ser menor que 0',
      );
    }

    this.validateNumericRange(
      dto.mesesMoraDesde,
      dto.mesesMoraHasta,
      'mesesMoraDesde',
      'mesesMoraHasta',
    );
    this.validateDateRange(
      dto.fechaDesde,
      dto.fechaHasta,
      'fechaDesde',
      'fechaHasta',
    );
  }

  private validateNumericRange(
    desde: number | undefined,
    hasta: number | undefined,
    desdeName: string,
    hastaName: string,
  ) {
    if (desde !== undefined && hasta !== undefined && desde > hasta) {
      throw new BadRequestException(
        `${desdeName} no puede ser mayor que ${hastaName}`,
      );
    }
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
      `findAll pagos-por-franja lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} offset=${input.offset} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql pagos-por-franja ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }

  private rethrowKnownOracleError(error: unknown): never {
    const code = this.extractOracleErrorCode(error);
    const message = error instanceof Error ? error.message : String(error);

    if (code === 'ORA-04045' || code === 'ORA-16000') {
      this.logger.error(
        `pagos-por-franja source unavailable code=${code} message=${message}`,
      );
      throw new ServiceUnavailableException(
        'La vista Oracle ADCC.CBI_CUOTAS_PAGADAS_V no esta disponible para pagos-por-franja. Debe corregirse o recompilarse en origen.',
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

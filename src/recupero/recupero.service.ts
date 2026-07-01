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
  RecuperoItemDto,
  RecuperoQueryDto,
  RecuperoResponseDto,
} from './recupero.dto';

type RecuperoResponse = RecuperoResponseDto<RecuperoItemDto>;

type OracleRow = {
  CONTRATO?: unknown;
  VENDEDOR?: unknown;
  NOMBRE_COMPLETO?: unknown;
  CI_RUC?: unknown;
  TELEFONO_PARTICULAR?: unknown;
  SUCURSAL?: unknown;
  NOMBRE_FRACCION?: unknown;
  MANZANA?: unknown;
  LOTE?: unknown;
  VENCIMIENTO?: unknown;
  IMPORTE_CUOTA?: unknown;
  PLAZO?: unknown;
  MESES_ATRASO?: unknown;
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
export class RecuperoService {
  private static readonly DEFAULT_MAX_LIMIT = 5000;
  private readonly logger = new Logger(RecuperoService.name);
  private readonly cache = new Map<string, CacheEntry<RecuperoResponse>>();
  private readonly inFlight = new Map<string, Promise<RecuperoResponse>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly maxLimit: number;
  private readonly logSlowSql: boolean;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('RECUPERO_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('RECUPERO_CACHE_MAX_ITEMS'),
      200,
    );
    this.maxLimit = parsePositiveNumber(
      this.configService.get('RECUPERO_MAX_LIMIT'),
      RecuperoService.DEFAULT_MAX_LIMIT,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(dto: RecuperoQueryDto): Promise<RecuperoResponse> {
    this.validateDto(dto);

    const startedAt = Date.now();
    const limite = Math.min(Math.max(dto.limite || 100, 1), this.maxLimit);
    const offset = Math.max(dto.offset || 0, 0);
    const incluirTotal = dto.incluirTotal === true;
    const pagina = Math.floor(offset / limite) + 1;
    const normalizedDto: RecuperoQueryDto = {
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
        `cache hit recupero limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join recupero limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
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
        const response: RecuperoResponse = {
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
          filters: countActiveFilters(normalizedRecord, [
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
      const response: RecuperoResponse = {
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

  private buildQueries(
    dto: RecuperoQueryDto,
    limite: number,
    offset: number,
  ): QueryBundle {
    const params: Record<string, unknown> = { limite, offset };
    const whereSql = this.buildWhere(dto, params);
    const baseSql = `
      SELECT
        inm.CONTRATO,
        ccv.VENDEDOR,
        ccv.NOMBRE_COMPLETO,
        inm.CI_RUC,
        ccv.TELEFONO_PARTICULAR,
        inm.SUCURSAL,
        ccv.NOMBRE_FRACCION,
        inm.MANZANA,
        inm.LOTE,
        inm.VENCIMIENTO,
        inm.IMPORTE_CUOTA,
        inm.PLAZO,
        inm.MESES_ATRASO,
        inm.FRACCION
      FROM ADCC.CBI_CLIENTES_V ccv
      JOIN ADCC.CBI_INMC093_V inm
        ON inm.CONTRATO = ccv.NUMERO_CONTRATO
      ${whereSql}
    `;

    const dataSql = `
      SELECT
        CONTRATO,
        VENDEDOR,
        NOMBRE_COMPLETO,
        CI_RUC,
        TELEFONO_PARTICULAR,
        SUCURSAL,
        NOMBRE_FRACCION,
        MANZANA,
        LOTE,
        VENCIMIENTO,
        IMPORTE_CUOTA,
        PLAZO,
        MESES_ATRASO
      FROM (
        SELECT q.*,
               ROW_NUMBER() OVER (
                 ORDER BY
                   q.CONTRATO ASC,
                   q.FRACCION ASC,
                   q.MANZANA ASC,
                   q.LOTE ASC,
                   q.VENCIMIENTO ASC
               ) AS RN
        FROM (
          ${baseSql}
        ) q
      )
      WHERE RN > :offset
        AND RN <= (:offset + :limite)
      ORDER BY
        CONTRATO ASC,
        FRACCION ASC,
        MANZANA ASC,
        LOTE ASC,
        VENCIMIENTO ASC
    `;

    const countSql = `
      SELECT COUNT(*) AS TOTAL
      FROM (
        ${baseSql}
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
    dto: RecuperoQueryDto,
    params: Record<string, unknown>,
  ): string {
    const clauses: string[] = [];

    this.addExactFilter(clauses, params, 'inm.CONTRATO', 'contrato', dto.contrato);
    this.addExactFilter(clauses, params, 'ccv.VENDEDOR', 'vendedor', dto.vendedor);
    this.addExactFilter(
      clauses,
      params,
      'ccv.NOMBRE_COMPLETO',
      'nombreCompleto',
      dto.nombreCompleto,
    );
    this.addExactFilter(clauses, params, 'inm.CI_RUC', 'ciRuc', dto.ciRuc);
    this.addExactFilter(
      clauses,
      params,
      'ccv.TELEFONO_PARTICULAR',
      'telefonoParticular',
      dto.telefonoParticular,
    );
    this.addExactFilter(clauses, params, 'inm.SUCURSAL', 'sucursal', dto.sucursal);
    this.addExactFilter(
      clauses,
      params,
      'ccv.NOMBRE_FRACCION',
      'nombreFraccion',
      dto.nombreFraccion,
    );
    this.addExactFilter(clauses, params, 'inm.MANZANA', 'manzana', dto.manzana);
    this.addExactFilter(clauses, params, 'inm.LOTE', 'lote', dto.lote);

    if (dto.vencimientoDesde) {
      clauses.push(
        `inm.VENCIMIENTO >= TO_DATE(:vencimientoDesde, 'YYYY-MM-DD')`,
      );
      params.vencimientoDesde = dto.vencimientoDesde;
    }

    if (dto.vencimientoHasta) {
      clauses.push(
        `inm.VENCIMIENTO < TO_DATE(:vencimientoHasta, 'YYYY-MM-DD') + 1`,
      );
      params.vencimientoHasta = dto.vencimientoHasta;
    }

    this.addNumericFilter(
      clauses,
      params,
      'inm.IMPORTE_CUOTA',
      'importeCuota',
      dto.importeCuota,
      dto.importeCuotaDesde,
      dto.importeCuotaHasta,
    );
    this.addNumericFilter(
      clauses,
      params,
      'inm.PLAZO',
      'plazo',
      dto.plazo,
      dto.plazoDesde,
      dto.plazoHasta,
    );
    this.addNumericFilter(
      clauses,
      params,
      'inm.MESES_ATRASO',
      'mesesAtraso',
      dto.mesesAtraso,
      dto.mesesAtrasoDesde,
      dto.mesesAtrasoHasta,
    );

    return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  }

  private addExactFilter(
    clauses: string[],
    params: Record<string, unknown>,
    column: string,
    paramName: string,
    value?: string,
  ) {
    if (value === undefined || value === '') {
      return;
    }

    clauses.push(`${column} = :${paramName}`);
    params[paramName] = value;
  }

  private addNumericFilter(
    clauses: string[],
    params: Record<string, unknown>,
    column: string,
    paramName: string,
    exact?: number,
    desde?: number,
    hasta?: number,
  ) {
    if (exact !== undefined) {
      clauses.push(`${column} = :${paramName}`);
      params[paramName] = exact;
      return;
    }

    if (desde !== undefined) {
      const desdeParam = `${paramName}Desde`;
      clauses.push(`${column} >= :${desdeParam}`);
      params[desdeParam] = desde;
    }

    if (hasta !== undefined) {
      const hastaParam = `${paramName}Hasta`;
      clauses.push(`${column} <= :${hastaParam}`);
      params[hastaParam] = hasta;
    }
  }

  private mapRows(rows: OracleRow[]): RecuperoItemDto[] {
    return rows.map((row) => ({
      contrato: this.normalizeString(row.CONTRATO),
      vendedor: this.normalizeString(row.VENDEDOR),
      nombreCompleto: this.normalizeString(row.NOMBRE_COMPLETO),
      ciRuc: this.normalizeString(row.CI_RUC),
      telefonoParticular: this.normalizeString(row.TELEFONO_PARTICULAR),
      sucursal: this.normalizeString(row.SUCURSAL),
      nombreFraccion: this.normalizeString(row.NOMBRE_FRACCION),
      manzana: this.normalizeString(row.MANZANA),
      lote: this.normalizeString(row.LOTE),
      vencimiento: this.normalizeDate(row.VENCIMIENTO),
      importeCuota: this.normalizeNullableNumber(row.IMPORTE_CUOTA),
      plazo: this.normalizeNullableNumber(row.PLAZO),
      mesesAtraso: this.normalizeNullableNumber(row.MESES_ATRASO),
    }));
  }

  private normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
  }

  private normalizeDate(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
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

  private validateDto(dto: RecuperoQueryDto) {
    this.validateExactOrRange(
      dto.importeCuota,
      dto.importeCuotaDesde,
      dto.importeCuotaHasta,
      'importeCuota',
      'importeCuotaDesde',
      'importeCuotaHasta',
    );
    this.validateExactOrRange(
      dto.plazo,
      dto.plazoDesde,
      dto.plazoHasta,
      'plazo',
      'plazoDesde',
      'plazoHasta',
    );
    this.validateExactOrRange(
      dto.mesesAtraso,
      dto.mesesAtrasoDesde,
      dto.mesesAtrasoHasta,
      'mesesAtraso',
      'mesesAtrasoDesde',
      'mesesAtrasoHasta',
    );
    this.validateDateRange(
      dto.vencimientoDesde,
      dto.vencimientoHasta,
      'vencimientoDesde',
      'vencimientoHasta',
    );
  }

  private validateExactOrRange(
    exact: number | undefined,
    desde: number | undefined,
    hasta: number | undefined,
    exactName: string,
    desdeName: string,
    hastaName: string,
  ) {
    if (exact !== undefined && (desde !== undefined || hasta !== undefined)) {
      throw new BadRequestException(
        `No puedes enviar ${exactName} junto con ${desdeName} o ${hastaName}`,
      );
    }

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
      `findAll recupero lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} offset=${input.offset} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql recupero ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }

  private rethrowKnownOracleError(error: unknown): never {
    const code = this.extractOracleErrorCode(error);
    const message = error instanceof Error ? error.message : String(error);

    if (code === 'ORA-04045' || code === 'ORA-16000') {
      this.logger.error(
        `recupero source unavailable code=${code} message=${message}`,
      );
      throw new ServiceUnavailableException(
        'Las vistas Oracle ADCC.CBI_CLIENTES_V o ADCC.CBI_INMC093_V no estan disponibles para recupero. Deben corregirse o recompilarse en origen.',
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

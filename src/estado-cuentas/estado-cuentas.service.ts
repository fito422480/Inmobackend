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
  EstadoCuentaDto,
  EstadoCuentasQueryDto,
  EstadoCuentasResponseDto,
} from './estado-cuentas.dto';

type EstadoCuentasResponse = EstadoCuentasResponseDto<EstadoCuentaDto>;

type CursorPayload = {
  c: string;
  q: number;
};

type OracleRow = {
  NOMBRE_COMPLETO?: unknown;
  DOCUMENTO?: unknown;
  TELEFONO_PARTICULAR?: unknown;
  TELEFONO_OFICINA?: unknown;
  CONTRATO?: unknown;
  ESTADO?: unknown;
  MESES_ATRASO?: unknown;
  NUMERO_CUOTA?: unknown;
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
export class EstadoCuentasService {
  private static readonly DEFAULT_MAX_LIMIT = 5000;
  private static readonly ESTADO_ACTIVO = 'Activo';
  private static readonly ESTADO_BLOQUEADO = 'Bloqueado';
  private static readonly MESES_ATRASO_MINIMO = 2;
  private readonly logger = new Logger(EstadoCuentasService.name);
  private readonly cache = new Map<string, CacheEntry<EstadoCuentasResponse>>();
  private readonly inFlight = new Map<string, Promise<EstadoCuentasResponse>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly maxLimit: number;
  private readonly logSlowSql: boolean;

  constructor(
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('ESTADO_CUENTAS_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('ESTADO_CUENTAS_CACHE_MAX_ITEMS'),
      200,
    );
    this.maxLimit = parsePositiveNumber(
      this.configService.get('ESTADO_CUENTAS_MAX_LIMIT'),
      EstadoCuentasService.DEFAULT_MAX_LIMIT,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(dto: EstadoCuentasQueryDto): Promise<EstadoCuentasResponse> {
    this.validateDto(dto);

    const startedAt = Date.now();
    const limite = Math.min(Math.max(dto.limite || 100, 1), this.maxLimit);
    const incluirTotal = dto.incluirTotal === true;
    const usarCursor = dto.cursor !== undefined || dto.offset === undefined;
    const normalizedDto: EstadoCuentasQueryDto = {
      ...dto,
      limite,
      incluirTotal,
    };

    if (!usarCursor) {
      normalizedDto.offset = Math.max(dto.offset || 0, 0);
    }

    const cacheKey = buildStableCacheKey({
      ...(normalizedDto as Record<string, unknown>),
      modoPaginacion: usarCursor ? 'cursor' : 'offset',
    });
    const cached = getCacheValue(this.cache, cacheKey);
    if (cached) {
      this.logger.debug(
        `cache hit estado-cuentas modo=${usarCursor ? 'cursor' : 'offset'} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join estado-cuentas modo=${usarCursor ? 'cursor' : 'offset'} incluirTotal=${incluirTotal}`,
      );
      return pending;
    }

    const activeFilters = countActiveFilters(
      normalizedDto as Record<string, unknown>,
      ['limite', 'offset', 'cursor', 'incluirTotal'],
    );

    const loadPromise = (async () => {
      const response = usarCursor
        ? await this.findAllByCursor(
            normalizedDto,
            limite,
            incluirTotal,
            startedAt,
            activeFilters,
          )
        : await this.findAllByOffset(
            normalizedDto,
            limite,
            Math.max(normalizedDto.offset || 0, 0),
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
    } catch (error) {
      this.rethrowKnownOracleError(error);
    } finally {
      if (this.inFlight.get(cacheKey) === loadPromise) {
        this.inFlight.delete(cacheKey);
      }
    }
  }

  private async findAllByCursor(
    dto: EstadoCuentasQueryDto,
    limite: number,
    incluirTotal: boolean,
    startedAt: number,
    filters: number,
  ): Promise<EstadoCuentasResponse> {
    const queryBundle = this.buildQueries(dto, limite + 1, null, 'cursor');
    const querySnapshots: QueryDebugSnapshot[] = [
      this.captureQuerySnapshot(
        'data',
        queryBundle.dataSql,
        queryBundle.dataParams,
      ),
    ];

    const dataPromise = measureAsync(() =>
      this.executeQuery(queryBundle.dataSql, queryBundle.dataParams),
    );
    const countPromise = incluirTotal
      ? measureAsync(() =>
          this.executeQuery(queryBundle.countSql, queryBundle.countParams),
        )
      : Promise.resolve(null);

    if (incluirTotal) {
      querySnapshots.unshift(
        this.captureQuerySnapshot(
          'count',
          queryBundle.countSql,
          queryBundle.countParams,
        ),
      );
    }

    const [countResult, dataResult] = await Promise.all([
      countPromise,
      dataPromise,
    ]);
    const rows = dataResult.result as OracleRow[];
    const tieneMas = rows.length > limite;
    const data = this.mapRows(rows.slice(0, limite));
    const lastItem = data[data.length - 1];
    const response: EstadoCuentasResponse = {
      data,
      total: countResult
        ? this.extractTotal(countResult.result as OracleRow[])
        : null,
      limite,
      offset: null,
      pagina: null,
      totalPaginas: countResult
        ? Math.ceil(
            this.extractTotal(countResult.result as OracleRow[]) / limite,
          )
        : null,
      incluirTotal,
      modoPaginacion: 'cursor',
      cursorActual: dto.cursor ?? null,
      nextCursor: tieneMas && lastItem ? this.encodeCursor(lastItem) : null,
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

  private async findAllByOffset(
    dto: EstadoCuentasQueryDto,
    limite: number,
    offset: number,
    incluirTotal: boolean,
    startedAt: number,
    filters: number,
  ): Promise<EstadoCuentasResponse> {
    const pagina = Math.floor(offset / limite) + 1;
    const queryBundle = this.buildQueries(
      dto,
      incluirTotal ? limite : limite + 1,
      offset,
      'offset',
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
      const response: EstadoCuentasResponse = {
        data: this.mapRows(rows.slice(0, limite)),
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
    const response: EstadoCuentasResponse = {
      data: this.mapRows(dataResult.result as OracleRow[]),
      total,
      limite,
      offset,
      pagina,
      totalPaginas: Math.ceil(total / limite),
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

  private buildQueries(
    dto: EstadoCuentasQueryDto,
    limite: number,
    offset: number | null,
    modoPaginacion: 'cursor' | 'offset',
  ): QueryBundle {
    const dataBaseParams: Record<string, unknown> = {
      mesesAtrasoMinimo: EstadoCuentasService.MESES_ATRASO_MINIMO,
      estadoActivo: EstadoCuentasService.ESTADO_ACTIVO,
      estadoBloqueado: EstadoCuentasService.ESTADO_BLOQUEADO,
    };
    const countBaseParams: Record<string, unknown> = {
      mesesAtrasoMinimo: EstadoCuentasService.MESES_ATRASO_MINIMO,
      estadoActivo: EstadoCuentasService.ESTADO_ACTIVO,
      estadoBloqueado: EstadoCuentasService.ESTADO_BLOQUEADO,
    };
    const dataWhereSql = this.buildWhere(dto, dataBaseParams, modoPaginacion);
    const countWhereSql = this.buildWhere(dto, countBaseParams, 'offset');
    const dataBaseSql = this.buildBaseSql(dataWhereSql);
    const countBaseSql = this.buildCountBaseSql(countWhereSql);

    const dataParams = {
      ...dataBaseParams,
      limite,
      ...(offset !== null ? { offset } : {}),
    };
    const countParams = this.omitPaginationAndCursorParams(countBaseParams);

    const dataSql =
      modoPaginacion === 'cursor'
        ? this.buildCursorDataSql(dataBaseSql, limite)
        : this.buildOffsetDataSql(dataBaseSql, limite);

    const countSql = `
      SELECT COUNT(*) AS TOTAL
      FROM (
        ${countBaseSql}
      )
    `;

    return {
      dataSql: this.normalizeSql(dataSql),
      countSql: this.normalizeSql(countSql),
      dataParams,
      countParams,
    };
  }

  private buildBaseSql(whereSql: string): string {
    return `
      SELECT
        ccv.NOMBRE_COMPLETO AS NOMBRE_COMPLETO,
        ccv.DOCUMENTO AS DOCUMENTO,
        ccv.TELEFONO_PARTICULAR AS TELEFONO_PARTICULAR,
        ccv.TELEFONO_OFICINA AS TELEFONO_OFICINA,
        civ.CONTRATO AS CONTRATO,
        civ.ESTADO AS ESTADO,
        civ.MESES_ATRASO AS MESES_ATRASO,
        ccv2.NUMERO_CUOTA AS NUMERO_CUOTA
      FROM ADCC.CBI_INMC093_V civ
      JOIN ADCC.CBI_CLIENTES_V ccv
        ON ccv.NUMERO_CONTRATO = civ.CONTRATO
      JOIN ADCC.CBI_CUOTAS_V ccv2
        ON ccv2.NUMERO_CONTRATO = civ.CONTRATO
      ${whereSql}
    `;
  }

  private buildCountBaseSql(whereSql: string): string {
    return `
      SELECT 1
      FROM ADCC.CBI_INMC093_V civ
      JOIN ADCC.CBI_CLIENTES_V ccv
        ON ccv.NUMERO_CONTRATO = civ.CONTRATO
      JOIN ADCC.CBI_CUOTAS_V ccv2
        ON ccv2.NUMERO_CONTRATO = civ.CONTRATO
      ${whereSql}
    `;
  }

  private buildCursorDataSql(baseSql: string, limite: number): string {
    return `
      SELECT *
      FROM (
        SELECT /*+ FIRST_ROWS(${limite}) */
          d.NOMBRE_COMPLETO,
          d.DOCUMENTO,
          d.TELEFONO_PARTICULAR,
          d.TELEFONO_OFICINA,
          d.CONTRATO,
          d.ESTADO,
          d.MESES_ATRASO,
          d.NUMERO_CUOTA
        FROM (
          ${baseSql}
        ) d
        ORDER BY d.CONTRATO ASC, d.NUMERO_CUOTA ASC
      )
      WHERE ROWNUM <= :limite
    `;
  }

  private buildOffsetDataSql(baseSql: string, limite: number): string {
    return `
      SELECT
        NOMBRE_COMPLETO,
        DOCUMENTO,
        TELEFONO_PARTICULAR,
        TELEFONO_OFICINA,
        CONTRATO,
        ESTADO,
        MESES_ATRASO,
        NUMERO_CUOTA
      FROM (
        SELECT /*+ FIRST_ROWS(${limite}) */
          d.*,
          ROW_NUMBER() OVER (
            ORDER BY d.CONTRATO ASC, d.NUMERO_CUOTA ASC
          ) AS RN
        FROM (
          ${baseSql}
        ) d
      )
      WHERE RN > :offset
        AND RN <= (:offset + :limite)
      ORDER BY CONTRATO ASC, NUMERO_CUOTA ASC
    `;
  }

  private buildWhere(
    dto: EstadoCuentasQueryDto,
    params: Record<string, unknown>,
    modoPaginacion: 'cursor' | 'offset',
  ): string {
    const clauses: string[] = [
      'civ.MESES_ATRASO >= :mesesAtrasoMinimo',
      'civ.ESTADO IN (:estadoActivo, :estadoBloqueado)',
      'ccv2.FECHA_VENCIMIENTO <= ADD_MONTHS(SYSDATE, -1)',
    ];

    if (dto.documento) {
      clauses.push('ccv.DOCUMENTO = :documento');
      params.documento = dto.documento;
    }

    if (dto.contrato) {
      clauses.push('civ.CONTRATO = :contrato');
      params.contrato = dto.contrato;
    }

    if (modoPaginacion === 'cursor' && dto.cursor) {
      const cursor = this.decodeCursor(dto.cursor);
      clauses.push(`(
        civ.CONTRATO > :cursorContrato
        OR (
          civ.CONTRATO = :cursorContrato
          AND ccv2.NUMERO_CUOTA > :cursorNumeroCuota
        )
      )`);
      params.cursorContrato = cursor.c;
      params.cursorNumeroCuota = cursor.q;
    }

    return `WHERE ${clauses.join(' AND ')}`;
  }

  private mapRows(rows: OracleRow[]): EstadoCuentaDto[] {
    return rows.map((row) => ({
      nombreCompleto: this.normalizeString(row.NOMBRE_COMPLETO),
      documento: this.normalizeString(row.DOCUMENTO),
      telefonoParticular: this.normalizeNullableString(
        row.TELEFONO_PARTICULAR,
      ),
      telefonoOficina: this.normalizeNullableString(row.TELEFONO_OFICINA),
      contrato: this.normalizeString(row.CONTRATO),
      estado: this.normalizeString(row.ESTADO),
      mesesAtraso: this.normalizeNumber(row.MESES_ATRASO),
      numeroCuota: this.normalizeNumber(row.NUMERO_CUOTA),
    }));
  }

  private encodeCursor(item: EstadoCuentaDto): string {
    const payload: CursorPayload = {
      c: item.contrato,
      q: item.numeroCuota,
    };

    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): CursorPayload {
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as Partial<CursorPayload>;

      if (typeof parsed.c !== 'string' || typeof parsed.q !== 'number') {
        throw new Error('Cursor incompleto');
      }

      return {
        c: parsed.c,
        q: parsed.q,
      };
    } catch {
      throw new BadRequestException('Cursor invalido');
    }
  }

  private normalizeString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }

  private normalizeNullableString(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return String(value);
  }

  private normalizeNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
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

  private omitPaginationAndCursorParams(
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const {
      limite,
      offset,
      cursorContrato,
      cursorNumeroCuota,
      ...rest
    } = params;
    return rest;
  }

  private validateDto(dto: EstadoCuentasQueryDto) {
    if (dto.limite !== undefined && dto.limite < 1) {
      throw new BadRequestException('limit debe ser mayor o igual a 1');
    }

    if (dto.offset !== undefined && dto.offset < 0) {
      throw new BadRequestException('offset debe ser mayor o igual a 0');
    }
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
      `findAll estado-cuentas lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters} modo=${input.modoPaginacion}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql estado-cuentas ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }

  private rethrowKnownOracleError(error: unknown): never {
    const code = this.extractOracleErrorCode(error);
    const message = error instanceof Error ? error.message : String(error);

    if (code === 'ORA-04045' || code === 'ORA-16000') {
      this.logger.error(
        `estado-cuentas source unavailable code=${code} message=${message}`,
      );
      throw new ServiceUnavailableException(
        'Las fuentes Oracle ADCC.CBI_CLIENTES_V, ADCC.CBI_INMC093_V o ADCC.CBI_CUOTAS_V no estan disponibles para estado-cuentas. Deben corregirse o recompilarse en origen.',
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

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
  CuotaGeneralDto,
  CuotasGeneralQueryDto,
  CuotasGeneralResponseDto,
} from './cuotas-general.dto';

type CuotasGeneralResponse = CuotasGeneralResponseDto<CuotaGeneralDto>;

type OracleRow = {
  ID_FRACCION?: unknown;
  NOMBRE_FRACCION?: unknown;
  ID_MANZANA?: unknown;
  ID_LOTE?: unknown;
  NUMERO_CONTRATO?: unknown;
  SUCURSAL?: unknown;
  NOMBRE_PARA_DOCUMENTO?: unknown;
  ID_CLIENTE?: unknown;
  DOCUMENTO?: unknown;
  NUMERO_CUOTA?: unknown;
  TOTAL_CUOTAS?: unknown;
  ESTADO_ACTUAL_CONTRATO?: unknown;
  MONTO_CUOTA?: unknown;
  MORA_CUOTA?: unknown;
  FECHA_VENCIMIENTO?: unknown;
  MESES_MORA?: unknown;
  INTERES_COBRADO?: unknown;
  DESCUENTO_INTERES?: unknown;
  CUOTA_COBRADA?: unknown;
  NOTA_CRED?: unknown;
  TELEFONO_CELULAR?: unknown;
  FECHA_PAGO?: unknown;
  MONEDA?: unknown;
  NRO_FACTURA?: unknown;
  FORMA_PAGO?: unknown;
  FEC_CONTRATO?: unknown;
  FEC_TRATO?: unknown;
  VENDEDOR?: unknown;
  PLAN_PAGO_VENDEDOR?: unknown;
  REFINANCIACION?: unknown;
  CANCELACION_ANTICIPADA?: unknown;
  SALDO_VENCIDO?: unknown;
  ULTIMO_PAGO?: unknown;
  ESTADO_CUOTA?: unknown;
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
export class CuotasGeneralService {
  private static readonly DEFAULT_MAX_LIMIT = 5000;
  private readonly logger = new Logger(CuotasGeneralService.name);
  private readonly cache = new Map<string, CacheEntry<CuotasGeneralResponse>>();
  private readonly inFlight = new Map<string, Promise<CuotasGeneralResponse>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly maxLimit: number;
  private readonly logSlowSql: boolean;

  constructor(
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('CUOTAS_GENERAL_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('CUOTAS_GENERAL_CACHE_MAX_ITEMS'),
      200,
    );
    this.maxLimit = parsePositiveNumber(
      this.configService.get('CUOTAS_GENERAL_MAX_LIMIT'),
      CuotasGeneralService.DEFAULT_MAX_LIMIT,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(dto: CuotasGeneralQueryDto): Promise<CuotasGeneralResponse> {
    this.validateDto(dto);

    const startedAt = Date.now();
    const limite = Math.min(Math.max(dto.limite || 100, 1), this.maxLimit);
    const offset = Math.max(dto.offset || 0, 0);
    const incluirTotal = dto.incluirTotal === true;
    const pagina = Math.floor(offset / limite) + 1;
    const normalizedDto: CuotasGeneralQueryDto = {
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
        `cache hit cuotas-general limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join cuotas-general limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
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
        const response: CuotasGeneralResponse = {
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
      const response: CuotasGeneralResponse = {
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
    dto: CuotasGeneralQueryDto,
    limite: number,
    offset: number,
  ): QueryBundle {
    const params: Record<string, unknown> = { limite, offset };
    const whereSql = this.buildWhere(dto, params);
    const baseSql = `
      SELECT
        ID_FRACCION,
        NOMBRE_FRACCION,
        ID_MANZANA,
        ID_LOTE,
        NUMERO_CONTRATO,
        SUCURSAL,
        NOMBRE_PARA_DOCUMENTO,
        ID_CLIENTE,
        DOCUMENTO,
        NUMERO_CUOTA,
        TOTAL_CUOTAS,
        ESTADO_ACTUAL_CONTRATO,
        MONTO_CUOTA,
        MORA_CUOTA,
        FECHA_VENCIMIENTO,
        MESES_MORA,
        INTERES_COBRADO,
        DESCUENTO_INTERES,
        CUOTA_COBRADA,
        NOTA_CRED,
        TELEFONO_CELULAR,
        FECHA_PAGO,
        MONEDA,
        NRO_FACTURA,
        FORMA_PAGO,
        FEC_CONTRATO,
        FEC_TRATO,
        VENDEDOR,
        PLAN_PAGO_VENDEDOR,
        REFINANCIACION,
        CANCELACION_ANTICIPADA,
        SALDO_VENCIDO,
        ULTIMO_PAGO,
        ESTADO_CUOTA
      FROM ADCC.CBI_CUOTAS_GENERAL_V
      ${whereSql}
    `;

    const dataSql = `
      SELECT
        ID_FRACCION,
        NOMBRE_FRACCION,
        ID_MANZANA,
        ID_LOTE,
        NUMERO_CONTRATO,
        SUCURSAL,
        NOMBRE_PARA_DOCUMENTO,
        ID_CLIENTE,
        DOCUMENTO,
        NUMERO_CUOTA,
        TOTAL_CUOTAS,
        ESTADO_ACTUAL_CONTRATO,
        MONTO_CUOTA,
        MORA_CUOTA,
        FECHA_VENCIMIENTO,
        MESES_MORA,
        INTERES_COBRADO,
        DESCUENTO_INTERES,
        CUOTA_COBRADA,
        NOTA_CRED,
        TELEFONO_CELULAR,
        FECHA_PAGO,
        MONEDA,
        NRO_FACTURA,
        FORMA_PAGO,
        FEC_CONTRATO,
        FEC_TRATO,
        VENDEDOR,
        PLAN_PAGO_VENDEDOR,
        REFINANCIACION,
        CANCELACION_ANTICIPADA,
        SALDO_VENCIDO,
        ULTIMO_PAGO,
        ESTADO_CUOTA
      FROM (
        SELECT d.*,
               ROW_NUMBER() OVER (
                 ORDER BY
                   d.NUMERO_CONTRATO ASC,
                   d.NUMERO_CUOTA ASC,
                   d.FECHA_VENCIMIENTO ASC NULLS LAST,
                   d.ID_FRACCION ASC NULLS LAST,
                   d.ID_MANZANA ASC NULLS LAST,
                   d.ID_LOTE ASC NULLS LAST
               ) AS RN
        FROM (
          ${baseSql}
        ) d
      )
      WHERE RN > :offset
        AND RN <= (:offset + :limite)
      ORDER BY
        NUMERO_CONTRATO ASC,
        NUMERO_CUOTA ASC,
        FECHA_VENCIMIENTO ASC NULLS LAST,
        ID_FRACCION ASC NULLS LAST,
        ID_MANZANA ASC NULLS LAST,
        ID_LOTE ASC NULLS LAST
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
    dto: CuotasGeneralQueryDto,
    params: Record<string, unknown>,
  ): string {
    const clauses: string[] = [];

    this.addEqualsClause(clauses, params, 'ID_FRACCION', dto.idFraccion, 'idFraccion');
    this.addLikeClause(
      clauses,
      params,
      'NOMBRE_FRACCION',
      dto.nombreFraccion,
      'nombreFraccion',
    );
    this.addEqualsClause(clauses, params, 'ID_MANZANA', dto.idManzana, 'idManzana');
    this.addEqualsClause(clauses, params, 'ID_LOTE', dto.idLote, 'idLote');
    this.addEqualsClause(
      clauses,
      params,
      'NUMERO_CONTRATO',
      dto.numeroContrato,
      'numeroContrato',
    );
    this.addEqualsClause(clauses, params, 'SUCURSAL', dto.sucursal, 'sucursal');
    this.addLikeClause(
      clauses,
      params,
      'NOMBRE_PARA_DOCUMENTO',
      dto.nombreParaDocumento,
      'nombreParaDocumento',
    );
    this.addEqualsClause(clauses, params, 'ID_CLIENTE', dto.idCliente, 'idCliente');
    this.addEqualsClause(clauses, params, 'DOCUMENTO', dto.documento, 'documento');
    this.addEqualsClause(
      clauses,
      params,
      'NUMERO_CUOTA',
      dto.numeroCuota,
      'numeroCuota',
    );
    this.addRangeClause(
      clauses,
      params,
      'NUMERO_CUOTA',
      dto.numeroCuotaDesde,
      dto.numeroCuotaHasta,
      'numeroCuotaDesde',
      'numeroCuotaHasta',
    );
    this.addEqualsClause(
      clauses,
      params,
      'TOTAL_CUOTAS',
      dto.totalCuotas,
      'totalCuotas',
    );
    this.addEqualsClause(
      clauses,
      params,
      'ESTADO_ACTUAL_CONTRATO',
      dto.estadoActualContrato,
      'estadoActualContrato',
    );
    this.addRangeClause(
      clauses,
      params,
      'MONTO_CUOTA',
      dto.montoCuotaDesde,
      dto.montoCuotaHasta,
      'montoCuotaDesde',
      'montoCuotaHasta',
    );
    this.addRangeClause(
      clauses,
      params,
      'MORA_CUOTA',
      dto.moraCuotaDesde,
      dto.moraCuotaHasta,
      'moraCuotaDesde',
      'moraCuotaHasta',
    );
    this.addDateRangeClause(
      clauses,
      params,
      'FECHA_VENCIMIENTO',
      dto.fechaVencimientoDesde,
      dto.fechaVencimientoHasta,
      'fechaVencimientoDesde',
      'fechaVencimientoHasta',
    );
    this.addEqualsClause(clauses, params, 'MESES_MORA', dto.mesesMora, 'mesesMora');
    this.addRangeClause(
      clauses,
      params,
      'MESES_MORA',
      dto.mesesMoraDesde,
      dto.mesesMoraHasta,
      'mesesMoraDesde',
      'mesesMoraHasta',
    );
    this.addDateRangeClause(
      clauses,
      params,
      'FECHA_PAGO',
      dto.fechaPagoDesde,
      dto.fechaPagoHasta,
      'fechaPagoDesde',
      'fechaPagoHasta',
    );
    this.addEqualsClause(clauses, params, 'MONEDA', dto.moneda, 'moneda');
    this.addEqualsClause(clauses, params, 'NRO_FACTURA', dto.nroFactura, 'nroFactura');
    this.addEqualsClause(clauses, params, 'FORMA_PAGO', dto.formaPago, 'formaPago');
    this.addDateRangeClause(
      clauses,
      params,
      'FEC_CONTRATO',
      dto.fecContratoDesde,
      dto.fecContratoHasta,
      'fecContratoDesde',
      'fecContratoHasta',
    );
    this.addDateRangeClause(
      clauses,
      params,
      'FEC_TRATO',
      dto.fecTratoDesde,
      dto.fecTratoHasta,
      'fecTratoDesde',
      'fecTratoHasta',
    );
    this.addEqualsClause(clauses, params, 'VENDEDOR', dto.vendedor, 'vendedor');
    this.addEqualsClause(
      clauses,
      params,
      'PLAN_PAGO_VENDEDOR',
      dto.planPagoVendedor,
      'planPagoVendedor',
    );
    this.addEqualsClause(
      clauses,
      params,
      'REFINANCIACION',
      dto.refinanciacion,
      'refinanciacion',
    );
    this.addEqualsClause(
      clauses,
      params,
      'CANCELACION_ANTICIPADA',
      dto.cancelacionAnticipada,
      'cancelacionAnticipada',
    );
    this.addRangeClause(
      clauses,
      params,
      'SALDO_VENCIDO',
      dto.saldoVencidoDesde,
      dto.saldoVencidoHasta,
      'saldoVencidoDesde',
      'saldoVencidoHasta',
    );
    this.addDateRangeClause(
      clauses,
      params,
      'ULTIMO_PAGO',
      dto.ultimoPagoDesde,
      dto.ultimoPagoHasta,
      'ultimoPagoDesde',
      'ultimoPagoHasta',
    );
    this.addEqualsClause(
      clauses,
      params,
      'ESTADO_CUOTA',
      dto.estadoCuota,
      'estadoCuota',
    );

    if (!clauses.length) {
      return '';
    }

    return `WHERE ${clauses.join(' AND ')}`;
  }

  private addEqualsClause(
    clauses: string[],
    params: Record<string, unknown>,
    column: string,
    value: unknown,
    paramName: string,
  ) {
    if (value === undefined || value === null || value === '') {
      return;
    }

    clauses.push(`${column} = :${paramName}`);
    params[paramName] = value;
  }

  private addLikeClause(
    clauses: string[],
    params: Record<string, unknown>,
    column: string,
    value: string | undefined,
    paramName: string,
  ) {
    if (!value) {
      return;
    }

    clauses.push(`UPPER(${column}) LIKE :${paramName}`);
    params[paramName] = `%${value.toUpperCase()}%`;
  }

  private addRangeClause(
    clauses: string[],
    params: Record<string, unknown>,
    column: string,
    desde: number | undefined,
    hasta: number | undefined,
    desdeParamName: string,
    hastaParamName: string,
  ) {
    if (desde !== undefined) {
      clauses.push(`${column} >= :${desdeParamName}`);
      params[desdeParamName] = desde;
    }

    if (hasta !== undefined) {
      clauses.push(`${column} <= :${hastaParamName}`);
      params[hastaParamName] = hasta;
    }
  }

  private addDateRangeClause(
    clauses: string[],
    params: Record<string, unknown>,
    column: string,
    desde: string | undefined,
    hasta: string | undefined,
    desdeParamName: string,
    hastaParamName: string,
  ) {
    if (desde) {
      clauses.push(`${column} >= TO_DATE(:${desdeParamName}, 'YYYY-MM-DD')`);
      params[desdeParamName] = desde;
    }

    if (hasta) {
      clauses.push(`${column} < TO_DATE(:${hastaParamName}, 'YYYY-MM-DD') + 1`);
      params[hastaParamName] = hasta;
    }
  }

  private mapRows(rows: OracleRow[]): CuotaGeneralDto[] {
    return rows.map((row) => ({
      idFraccion: this.normalizeNumber(row.ID_FRACCION),
      nombreFraccion: this.normalizeString(row.NOMBRE_FRACCION),
      idManzana: this.normalizeNumber(row.ID_MANZANA),
      idLote: this.normalizeNumber(row.ID_LOTE),
      numeroContrato: this.normalizeString(row.NUMERO_CONTRATO),
      sucursal: this.normalizeString(row.SUCURSAL),
      nombreParaDocumento: this.normalizeString(row.NOMBRE_PARA_DOCUMENTO),
      idCliente: this.normalizeNumber(row.ID_CLIENTE),
      documento: this.normalizeString(row.DOCUMENTO),
      numeroCuota: this.normalizeNumber(row.NUMERO_CUOTA),
      totalCuotas: this.normalizeNumber(row.TOTAL_CUOTAS),
      estadoActualContrato: this.normalizeString(row.ESTADO_ACTUAL_CONTRATO),
      montoCuota: this.normalizeNumber(row.MONTO_CUOTA),
      moraCuota: this.normalizeNumber(row.MORA_CUOTA),
      fechaVencimiento: this.normalizeDate(row.FECHA_VENCIMIENTO),
      mesesMora: this.normalizeNumber(row.MESES_MORA),
      interesCobrado: this.normalizeNumber(row.INTERES_COBRADO),
      descuentoInteres: this.normalizeNumber(row.DESCUENTO_INTERES),
      cuotaCobrada: this.normalizeNumber(row.CUOTA_COBRADA),
      notaCred: this.normalizeNumber(row.NOTA_CRED),
      telefonoCelular: this.normalizeString(row.TELEFONO_CELULAR),
      fechaPago: this.normalizeDate(row.FECHA_PAGO),
      moneda: this.normalizeString(row.MONEDA),
      nroFactura: this.normalizeString(row.NRO_FACTURA),
      formaPago: this.normalizeString(row.FORMA_PAGO),
      fecContrato: this.normalizeDate(row.FEC_CONTRATO),
      fecTrato: this.normalizeDate(row.FEC_TRATO),
      vendedor: this.normalizeString(row.VENDEDOR),
      planPagoVendedor: this.normalizeString(row.PLAN_PAGO_VENDEDOR),
      refinanciacion: this.normalizeString(row.REFINANCIACION),
      cancelacionAnticipada: this.normalizeString(row.CANCELACION_ANTICIPADA),
      saldoVencido: this.normalizeNumber(row.SALDO_VENCIDO),
      ultimoPago: this.normalizeDate(row.ULTIMO_PAGO),
      estadoCuota: this.normalizeString(row.ESTADO_CUOTA),
    }));
  }

  private normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
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

  private normalizeNumber(value: unknown): number | null {
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
    return this.normalizeNumber(rows[0]?.TOTAL) ?? 0;
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

  private validateDto(dto: CuotasGeneralQueryDto) {
    if (
      dto.numeroCuota !== undefined &&
      (dto.numeroCuotaDesde !== undefined || dto.numeroCuotaHasta !== undefined)
    ) {
      throw new BadRequestException(
        'No puedes enviar numeroCuota junto con numeroCuotaDesde o numeroCuotaHasta',
      );
    }

    if (
      dto.mesesMora !== undefined &&
      (dto.mesesMoraDesde !== undefined || dto.mesesMoraHasta !== undefined)
    ) {
      throw new BadRequestException(
        'No puedes enviar mesesMora junto con mesesMoraDesde o mesesMoraHasta',
      );
    }

    this.validateNumericRange(
      dto.numeroCuotaDesde,
      dto.numeroCuotaHasta,
      'numeroCuotaDesde',
      'numeroCuotaHasta',
    );
    this.validateNumericRange(
      dto.mesesMoraDesde,
      dto.mesesMoraHasta,
      'mesesMoraDesde',
      'mesesMoraHasta',
    );
    this.validateNumericRange(
      dto.montoCuotaDesde,
      dto.montoCuotaHasta,
      'montoCuotaDesde',
      'montoCuotaHasta',
    );
    this.validateNumericRange(
      dto.moraCuotaDesde,
      dto.moraCuotaHasta,
      'moraCuotaDesde',
      'moraCuotaHasta',
    );
    this.validateNumericRange(
      dto.saldoVencidoDesde,
      dto.saldoVencidoHasta,
      'saldoVencidoDesde',
      'saldoVencidoHasta',
    );

    this.validateDateRange(
      dto.fechaVencimientoDesde,
      dto.fechaVencimientoHasta,
      'fechaVencimientoDesde',
      'fechaVencimientoHasta',
    );
    this.validateDateRange(
      dto.fechaPagoDesde,
      dto.fechaPagoHasta,
      'fechaPagoDesde',
      'fechaPagoHasta',
    );
    this.validateDateRange(
      dto.fecContratoDesde,
      dto.fecContratoHasta,
      'fecContratoDesde',
      'fecContratoHasta',
    );
    this.validateDateRange(
      dto.fecTratoDesde,
      dto.fecTratoHasta,
      'fecTratoDesde',
      'fecTratoHasta',
    );
    this.validateDateRange(
      dto.ultimoPagoDesde,
      dto.ultimoPagoHasta,
      'ultimoPagoDesde',
      'ultimoPagoHasta',
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
      `findAll cuotas-general lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} offset=${input.offset} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql cuotas-general ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }

  private rethrowKnownOracleError(error: unknown): never {
    const code = this.extractOracleErrorCode(error);
    const message = error instanceof Error ? error.message : String(error);

    if (code === 'ORA-04045' || code === 'ORA-16000') {
      this.logger.error(
        `cuotas-general source unavailable code=${code} message=${message}`,
      );
      throw new ServiceUnavailableException(
        'La vista Oracle ADCC.CBI_CUOTAS_GENERAL_V no esta disponible para cuotas-general. Debe corregirse o recompilarse en origen.',
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

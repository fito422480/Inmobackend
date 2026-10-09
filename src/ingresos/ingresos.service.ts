import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  buildStableCacheKey,
  CacheEntry,
  getCacheValue,
  measureAsync,
  parsePositiveNumber,
  setCacheValue,
} from '../common/query-performance.util';
import {
  IngresoCategoria,
  IngresoDetalleItemDto,
  IngresoDiaRowDto,
  IngresoResumenFechaDto,
  IngresosDetalleQueryDto,
  IngresosDetalleResponseDto,
  IngresosDiaResponseDto,
  IngresosRangoQueryDto,
} from './ingresos.dto';
import { IngresosEntity } from './ingresos.entity';

const MAX_RANGO_DIAS = 62;
const CATEGORIAS: IngresoCategoria[] = [
  'RECIBO_CUOTAS',
  'INTERESES',
  'GESTION_COBRANZAS',
  'CESION_DERECHOS',
  'FACTURACION_PROPIETARIOS',
  'OTROS_INGRESOS',
  'NOTA_CREDITO',
];

/**
 * CBI_FINC001_V une el documento con su detalle: un documento de varias lineas aparece repetido
 * con el mismo total de encabezado. Por eso se agrupa por documento (CLAVE) antes de sumar.
 *
 * Una factura de varias lineas se clasifica mirando TODAS sus lineas (no solo la primera).
 * La facturacion a propietarios (comisiones de administracion, ventas e intereses, recupero de gastos,
 * gastos de proyecto: p. ej. Fondo Investor) queda en su propia categoria, fuera del ingreso operativo,
 * con el campo `concepto` (si hay varias lineas, los conceptos van unidos con '+'). El total de
 * encabezado se repite en cada linea, por lo que no se puede repartir el importe entre conceptos.
 *
 * Se consideran: recibos de cobro (tipo 6), notas de credito emitidas (tipo 16) y facturas contado
 * (tipo 9) que tienen cuenta/caja. Las facturas contado sin cuenta son la "gemela" de cada recibo
 * (mismo importe) y se excluyen para no contar dos veces. No se consideran depositos/extracciones
 * (12/13, movimientos entre cajas), cancelaciones internas de saldo (47) ni la liquidacion a
 * propietarios (INMLIQPROP).
 */
const DOCS_SQL = `
WITH docs AS (
  SELECT clave, tipo_mov, numero_documento, cta_bancaria, moneda, fecha_documento, observacion,
         MIN(articulo) articulo, COUNT(*) lineas, MAX(total) total,
         MAX(CASE WHEN UPPER(articulo) LIKE '%GESTION DE COBRANZAS%' THEN 1 ELSE 0 END) f_gestion,
         MAX(CASE WHEN UPPER(articulo) LIKE '%CESI_N DE DERECHOS%' THEN 1 ELSE 0 END) f_cesion,
         MAX(CASE WHEN UPPER(articulo) LIKE 'COMISION POR ADMINISTRACION%' THEN 1 ELSE 0 END) f_adm,
         MAX(CASE WHEN UPPER(articulo) LIKE 'COMISIONES S/VENTAS%' THEN 1 ELSE 0 END) f_ventas,
         MAX(CASE WHEN UPPER(articulo) LIKE 'COMISION POR INTERESES%' THEN 1 ELSE 0 END) f_int,
         MAX(CASE WHEN UPPER(articulo) LIKE 'RECUPERO DE GASTOS%' THEN 1 ELSE 0 END) f_recupero,
         MAX(CASE WHEN UPPER(articulo) LIKE 'GASTOS POR DESARROLLO%'
                    OR UPPER(articulo) LIKE 'GASTOS DE INFRAESTRUCTURA%' THEN 1 ELSE 0 END) f_gastos,
         MAX(CASE WHEN UPPER(articulo) LIKE 'COMISION%' THEN 1 ELSE 0 END) f_comision
    FROM ADCC.CBI_FINC001_V
   WHERE fecha_documento >= TO_DATE(:1, 'YYYY-MM-DD')
     AND fecha_documento <  TO_DATE(:2, 'YYYY-MM-DD') + 1
     AND (tipo_mov LIKE '6 -%' OR tipo_mov LIKE '9 -%' OR tipo_mov LIKE '16 -%')
   GROUP BY clave, tipo_mov, numero_documento, cta_bancaria, moneda, fecha_documento, observacion
), clasif AS (
  SELECT d.*,
         CASE
           WHEN tipo_mov LIKE '6 -%' THEN 'RECIBO_CUOTAS'
           WHEN tipo_mov LIKE '16 -%' THEN 'NOTA_CREDITO'
           WHEN observacion IN ('INMFACINT', 'Operacion de Boca de Cobranza') THEN 'INTERESES'
           WHEN f_gestion = 1 THEN 'GESTION_COBRANZAS'
           WHEN f_cesion = 1 THEN 'CESION_DERECHOS'
           WHEN f_adm + f_ventas + f_int + f_recupero + f_gastos + f_comision > 0 THEN 'FACTURACION_PROPIETARIOS'
           ELSE 'OTROS_INGRESOS'
         END categoria,
         CASE
           WHEN tipo_mov LIKE '9 -%' AND f_gestion = 0 AND f_cesion = 0
            AND f_adm + f_ventas + f_int + f_recupero + f_gastos + f_comision > 0 THEN
             TRIM(BOTH '+' FROM
               CASE WHEN f_adm = 1 THEN 'ADMINISTRACION+' END ||
               CASE WHEN f_ventas = 1 THEN 'VENTAS+' END ||
               CASE WHEN f_int = 1 THEN 'INTERESES+' END ||
               CASE WHEN f_recupero = 1 THEN 'RECUPERO_GASTOS+' END ||
               CASE WHEN f_gastos = 1 THEN 'GASTOS_PROYECTO+' END ||
               CASE WHEN f_adm + f_ventas + f_int + f_gastos = 0 AND f_recupero = 0 THEN 'OTRA_COMISION+' END)
         END concepto
    FROM docs d
   WHERE tipo_mov LIKE '6 -%'
      OR tipo_mov LIKE '16 -%'
      OR (tipo_mov LIKE '9 -%'
          AND cta_bancaria IS NOT NULL
          AND NVL(observacion, ' ') <> 'INMLIQPROP'
          AND UPPER(NVL(articulo, ' ')) NOT LIKE '%LIQ. A PROPIETARIO%')
)`;

type RawRow = Record<string, unknown>;

@Injectable()
export class IngresosService {
  private readonly logger = new Logger(IngresosService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;

  constructor(
    @InjectRepository(IngresosEntity)
    private readonly repo: Repository<IngresosEntity>,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('INGRESOS_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('INGRESOS_CACHE_MAX_ITEMS'),
      200,
    );
  }

  async ingresosDia(dto: IngresosRangoQueryDto): Promise<IngresosDiaResponseDto> {
    this.validateRango(dto);
    return this.cached('ingresos-dia', { ...dto }, async () => {
      const sql = `${DOCS_SQL}
SELECT TO_CHAR(fecha_documento, 'YYYY-MM-DD') fecha, categoria, concepto, cta_bancaria cuenta, moneda,
       COUNT(*) documentos, SUM(total) total
  FROM clasif
 GROUP BY TO_CHAR(fecha_documento, 'YYYY-MM-DD'), categoria, concepto, cta_bancaria, moneda
 ORDER BY 1, 2, 3, 4`;
      const { result, durationMs } = await measureAsync(() =>
        this.repo.query(sql, [dto.fechaDesde, dto.fechaHasta]) as Promise<RawRow[]>,
      );
      this.logSlow('ingresos-dia', durationMs, result.length);

      const data: IngresoDiaRowDto[] = result.map((r) => ({
        fecha: String(this.pick(r, 'fecha')),
        categoria: this.pick(r, 'categoria') as IngresoCategoria,
        concepto: this.nullableString(this.pick(r, 'concepto')),
        cuenta: this.nullableString(this.pick(r, 'cuenta')),
        moneda: String(this.pick(r, 'moneda') ?? ''),
        documentos: this.num(this.pick(r, 'documentos')),
        total: this.num(this.pick(r, 'total')),
      }));

      return {
        fechaDesde: dto.fechaDesde,
        fechaHasta: dto.fechaHasta,
        data,
        resumenPorFecha: this.buildResumen(data),
      };
    });
  }

  async detalle(dto: IngresosDetalleQueryDto): Promise<IngresosDetalleResponseDto> {
    this.validateRango(dto);
    const categoria = this.validateCategoria(dto.categoria);
    const limite = Math.min(Math.max(dto.limite || 100, 1), 1000);
    const offset = Math.max(dto.offset || 0, 0);

    return this.cached(
      'ingresos-detalle',
      { ...dto, categoria: categoria ?? 'OTROS', limite, offset },
      async () => {
        // categoria viene de una lista cerrada (validateCategoria): se inyecta como literal, no como texto libre.
        const filtro = categoria
          ? `categoria = '${categoria}'`
          : `categoria NOT IN ('RECIBO_CUOTAS', 'NOTA_CREDITO')`;
        const sql = `${DOCS_SQL}
SELECT TO_CHAR(fecha_documento, 'YYYY-MM-DD') fecha, categoria, concepto, numero_documento, cta_bancaria cuenta,
       moneda, articulo, lineas, total, observacion
  FROM clasif
 WHERE ${filtro}
 ORDER BY fecha_documento, numero_documento, clave
OFFSET :3 ROWS FETCH NEXT :4 ROWS ONLY`;
        const { result, durationMs } = await measureAsync(() =>
          this.repo.query(sql, [
            dto.fechaDesde,
            dto.fechaHasta,
            offset,
            limite + 1,
          ]) as Promise<RawRow[]>,
        );
        this.logSlow('ingresos-detalle', durationMs, result.length);

        const rows = result.slice(0, limite);
        const data: IngresoDetalleItemDto[] = rows.map((r) => ({
          fecha: String(this.pick(r, 'fecha')),
          categoria: this.pick(r, 'categoria') as IngresoCategoria,
          concepto: this.nullableString(this.pick(r, 'concepto')),
          numeroDocumento: String(this.pick(r, 'numero_documento') ?? '').trim(),
          cuenta: this.nullableString(this.pick(r, 'cuenta')),
          moneda: String(this.pick(r, 'moneda') ?? ''),
          articulo: this.nullableString(this.pick(r, 'articulo')),
          lineas: this.num(this.pick(r, 'lineas')),
          total: this.num(this.pick(r, 'total')),
          observacion: this.nullableString(this.pick(r, 'observacion')),
        }));

        return {
          fechaDesde: dto.fechaDesde,
          fechaHasta: dto.fechaHasta,
          data,
          limite,
          offset,
          pagina: Math.floor(offset / limite) + 1,
          tieneMas: result.length > limite,
        };
      },
    );
  }

  private buildResumen(rows: IngresoDiaRowDto[]): IngresoResumenFechaDto[] {
    const map = new Map<string, IngresoResumenFechaDto>();
    for (const r of rows) {
      const key = `${r.fecha}|${r.moneda}`;
      let s = map.get(key);
      if (!s) {
        s = {
          fecha: r.fecha,
          moneda: r.moneda,
          cuotas: 0,
          intereses: 0,
          gestionCobranzas: 0,
          cesionDerechos: 0,
          otrosIngresos: 0,
          ingresoOperativo: 0,
          facturacionPropietarios: 0,
          notasCredito: 0,
        };
        map.set(key, s);
      }
      switch (r.categoria) {
        case 'RECIBO_CUOTAS':
          s.cuotas += r.total;
          break;
        case 'INTERESES':
          s.intereses += r.total;
          break;
        case 'GESTION_COBRANZAS':
          s.gestionCobranzas += r.total;
          break;
        case 'CESION_DERECHOS':
          s.cesionDerechos += r.total;
          break;
        case 'OTROS_INGRESOS':
          s.otrosIngresos += r.total;
          break;
        case 'FACTURACION_PROPIETARIOS':
          s.facturacionPropietarios += r.total;
          break;
        case 'NOTA_CREDITO':
          s.notasCredito += r.total;
          break;
      }
    }
    return [...map.values()].map((s) => ({
      ...s,
      ingresoOperativo:
        s.cuotas + s.intereses + s.gestionCobranzas + s.cesionDerechos + s.otrosIngresos,
    }));
  }

  private async cached<T>(
    name: string,
    keyInput: Record<string, unknown>,
    load: () => Promise<T>,
  ): Promise<T> {
    const key = `${name}:${buildStableCacheKey(keyInput)}`;
    const hit = getCacheValue(this.cache, key);
    if (hit) {
      return hit as T;
    }
    const pending = this.inFlight.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const promise = load();
    this.inFlight.set(key, promise);
    try {
      const value = await promise;
      setCacheValue(this.cache, key, value, this.cacheTtlMs, this.cacheMaxItems);
      return value;
    } catch (error) {
      this.rethrowKnownOracleError(error);
    } finally {
      if (this.inFlight.get(key) === promise) {
        this.inFlight.delete(key);
      }
    }
  }

  private validateRango(dto: IngresosRangoQueryDto) {
    const desde = this.parseFecha(dto.fechaDesde, 'fechaDesde');
    const hasta = this.parseFecha(dto.fechaHasta, 'fechaHasta');
    if (hasta < desde) {
      throw new BadRequestException('fechaHasta no puede ser anterior a fechaDesde');
    }
    const dias = Math.round((hasta - desde) / 86400000) + 1;
    if (dias > MAX_RANGO_DIAS) {
      throw new BadRequestException(
        `El rango maximo es de ${MAX_RANGO_DIAS} dias (pedido: ${dias})`,
      );
    }
  }

  private parseFecha(value: string, campo: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) {
      throw new BadRequestException(
        `${campo} es obligatoria con formato AAAA-MM-DD (use fecha= para un solo dia)`,
      );
    }
    const time = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${campo} no es una fecha valida: ${value}`);
    }
    return time;
  }

  private validateCategoria(value?: string): IngresoCategoria | null {
    if (!value) {
      return null;
    }
    const upper = value.toUpperCase();
    if (!(CATEGORIAS as string[]).includes(upper)) {
      throw new BadRequestException(
        `categoria invalida. Valores: ${CATEGORIAS.join(', ')}`,
      );
    }
    return upper as IngresoCategoria;
  }

  private pick(row: RawRow, name: string): unknown {
    return row[name] ?? row[name.toUpperCase()];
  }

  private nullableString(value: unknown): string | null {
    return value === null || value === undefined || value === ''
      ? null
      : String(value).trim();
  }

  private num(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private logSlow(name: string, durationMs: number, rows: number) {
    if (durationMs >= 1000) {
      this.logger.warn(`${name} lento duracion=${durationMs}ms rows=${rows}`);
    }
  }

  private rethrowKnownOracleError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.match(/ORA-\d{5}/)?.[0];
    if (code === 'ORA-04045' || code === 'ORA-16000') {
      this.logger.error(`ingresos source unavailable code=${code} message=${message}`);
      throw new ServiceUnavailableException(
        'La fuente Oracle ADCC.CBI_FINC001_V esta invalida y no puede revalidarse porque la base esta en modo read-only.',
      );
    }
    throw error;
  }
}

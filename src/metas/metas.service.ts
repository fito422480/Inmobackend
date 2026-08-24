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
  getCacheValue,
  measureAsync,
  parsePositiveNumber,
  setCacheValue,
} from '../common/query-performance.util';
import {
  MetaCobradorCodigo,
  MetaCobradorDto,
  MetasPeriodoDto,
  MetasQueryDto,
  MetasResponseDto,
} from './metas.dto';

type MetasOracleRow = {
  MATI_IMPORTE?: unknown;
  JESUS_IMPORTE?: unknown;
  JESUS_VENCIDO?: unknown;
  FERNANDO_IMPORTE?: unknown;
  FERNANDO_VENCIDO?: unknown;
  JUDICIALES_IMPORTE?: unknown;
  JUDICIALES_VENCIDO?: unknown;
};

const METAS_SQL = `
  SELECT
    NVL(SUM(CASE
      WHEN v.MESES_ATRASO = 0
       AND v.VENCIMIENTO < ADD_MONTHS(TO_DATE(:mesInicio, 'YYYY-MM-DD'), 1)
       AND NOT (
         v.CUOTA = v.PLAZO
         AND v.VENCIMIENTO < TO_DATE(:mesInicio, 'YYYY-MM-DD')
       )
      THEN NVL(v.IMPORTE_CUOTA, 0)
      ELSE 0
    END), 0) AS MATI_IMPORTE,
    NVL(SUM(CASE
      WHEN v.MESES_ATRASO > 0
       AND v.MESES_ATRASO < 3
       AND (v.PLAZO - v.CUOTA) <> 1
      THEN NVL(v.IMPORTE_CUOTA, 0)
      ELSE 0
    END), 0) AS JESUS_IMPORTE,
    NVL(SUM(CASE
      WHEN v.MESES_ATRASO > 0
       AND v.MESES_ATRASO < 3
       AND (v.PLAZO - v.CUOTA) <> 1
      THEN NVL(v.SALDO_VENCIDO, 0)
      ELSE 0
    END), 0) AS JESUS_VENCIDO,
    NVL(SUM(CASE
      WHEN v.MESES_ATRASO > 2
       AND v.MESES_ATRASO < 11
      THEN NVL(v.IMPORTE_CUOTA, 0)
      ELSE 0
    END), 0) AS FERNANDO_IMPORTE,
    NVL(SUM(CASE
      WHEN v.MESES_ATRASO > 2
       AND v.MESES_ATRASO < 11
      THEN NVL(v.SALDO_VENCIDO, 0)
      ELSE 0
    END), 0) AS FERNANDO_VENCIDO,
    NVL(SUM(CASE
      WHEN v.MESES_ATRASO > 10
       AND v.CUOTA <> v.PLAZO
      THEN NVL(v.IMPORTE_CUOTA, 0)
      ELSE 0
    END), 0) AS JUDICIALES_IMPORTE,
    NVL(SUM(CASE
      WHEN v.MESES_ATRASO > 10
       AND v.CUOTA <> v.PLAZO
      THEN NVL(v.SALDO_VENCIDO, 0)
      ELSE 0
    END), 0) AS JUDICIALES_VENCIDO
  FROM ADCC.CBI_INMC093_FOTO_V v
  WHERE v.ESTADO IN (:estadoActivo, :estadoBloqueado)
`;

@Injectable()
export class MetasService {
  private static readonly DEFAULT_TIME_ZONE = 'America/Asuncion';
  private readonly logger = new Logger(MetasService.name);
  private readonly cache = new Map<string, CacheEntry<MetasResponseDto>>();
  private readonly inFlight = new Map<string, Promise<MetasResponseDto>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly timeZone: string;
  private readonly logSlowSql: boolean;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('METAS_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('METAS_CACHE_MAX_ITEMS'),
      24,
    );
    this.timeZone =
      this.configService.get<string>('METAS_TIME_ZONE')?.trim() ||
      MetasService.DEFAULT_TIME_ZONE;
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async calcular(dto: MetasQueryDto = {}): Promise<MetasResponseDto> {
    const rawMes = dto.mes as unknown;
    if (rawMes !== undefined && typeof rawMes !== 'string') {
      throw new BadRequestException('mes debe enviarse una sola vez');
    }

    const requestedMonth = typeof rawMes === 'string' ? rawMes.trim() : '';
    const mes = requestedMonth || this.getCurrentMonth();
    const periodo = buildMetasPeriodo(mes);
    const cacheKey = periodo.mes;

    const cached = getCacheValue(this.cache, cacheKey);
    if (cached) {
      this.logger.debug(`cache hit metas mes=${periodo.mes}`);
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(`cache join metas mes=${periodo.mes}`);
      return pending;
    }

    const loadPromise = this.load(periodo).catch((error) =>
      this.rethrowKnownOracleError(error),
    );
    this.inFlight.set(cacheKey, loadPromise);

    try {
      const response = await loadPromise;
      setCacheValue(
        this.cache,
        cacheKey,
        response,
        this.cacheTtlMs,
        this.cacheMaxItems,
      );
      return response;
    } finally {
      if (this.inFlight.get(cacheKey) === loadPromise) {
        this.inFlight.delete(cacheKey);
      }
    }
  }

  private async load(periodo: MetasPeriodoDto): Promise<MetasResponseDto> {
    const queryResult = await measureAsync(() =>
      this.dataSource.query(METAS_SQL, {
        mesInicio: periodo.fechaInicio,
        estadoActivo: 'Activo',
        estadoBloqueado: 'Bloqueado',
      } as any),
    );
    const rows = queryResult.result as MetasOracleRow[];
    const response = this.mapResponse(rows[0], periodo);

    if (queryResult.durationMs >= 1000) {
      this.logger.warn(
        `calcular metas lento total=${queryResult.durationMs}ms mes=${periodo.mes}`,
      );

      if (this.logSlowSql) {
        this.logger.warn(
          `slow-sql metas sql=${this.normalizeSql(METAS_SQL)} params=${JSON.stringify({ mesInicio: periodo.fechaInicio })}`,
        );
      }
    }

    return response;
  }

  private mapResponse(
    row: MetasOracleRow | undefined,
    periodo: MetasPeriodoDto,
  ): MetasResponseDto {
    const data = [
      this.buildCartera(
        'MATI',
        'Mati',
        'Sin mora',
        this.normalizeNumber(row?.MATI_IMPORTE),
        0,
      ),
      this.buildCartera(
        'JESUS',
        'Jesus',
        '1 a 2 meses de mora',
        this.normalizeNumber(row?.JESUS_IMPORTE),
        this.normalizeNumber(row?.JESUS_VENCIDO),
      ),
      this.buildCartera(
        'FERNANDO',
        'Fernando',
        '3 a 10 meses de mora',
        this.normalizeNumber(row?.FERNANDO_IMPORTE),
        this.normalizeNumber(row?.FERNANDO_VENCIDO),
      ),
      this.buildCartera(
        'JUDICIALES',
        'Judiciales',
        'Mas de 10 meses de mora',
        this.normalizeNumber(row?.JUDICIALES_IMPORTE),
        this.normalizeNumber(row?.JUDICIALES_VENCIDO),
      ),
    ];

    return {
      periodo,
      data,
      totalCartera: data.reduce(
        (total, cartera) => total + cartera.valorCartera,
        0,
      ),
    };
  }

  private buildCartera(
    codigo: MetaCobradorCodigo,
    cobrador: string,
    tramoMora: string,
    importeCuotas: number,
    saldoVencido: number,
  ): MetaCobradorDto {
    return {
      codigo,
      cobrador,
      tramoMora,
      importeCuotas,
      saldoVencido,
      valorCartera: importeCuotas + saldoVencido,
    };
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

  private getCurrentMonth(): string {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: this.timeZone,
        year: 'numeric',
        month: '2-digit',
      }).formatToParts(new Date());
      const year = parts.find((part) => part.type === 'year')?.value;
      const month = parts.find((part) => part.type === 'month')?.value;

      if (!year || !month) {
        throw new Error('No se pudo determinar el mes actual');
      }

      return `${year}-${month}`;
    } catch (error) {
      this.logger.error(
        `zona horaria invalida para metas timeZone=${this.timeZone}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo determinar el mes actual para calcular las metas',
        { cause: error },
      );
    }
  }

  private normalizeSql(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  private rethrowKnownOracleError(error: unknown): never {
    const code = this.extractOracleErrorCode(error);
    const message = error instanceof Error ? error.message : String(error);

    if (['ORA-00942', 'ORA-04045', 'ORA-16000'].includes(code ?? '')) {
      this.logger.error(
        `fuente de metas no disponible code=${code} message=${message}`,
      );
      throw new ServiceUnavailableException(
        'La vista Oracle ADCC.CBI_INMC093_FOTO_V no esta disponible para calcular las metas',
      );
    }

    throw error;
  }

  private extractOracleErrorCode(error: unknown): string | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const candidate = error as { code?: unknown; message?: unknown };
    if (
      typeof candidate.code === 'string' &&
      candidate.code.startsWith('ORA-')
    ) {
      return candidate.code;
    }

    if (typeof candidate.message === 'string') {
      const match = candidate.message.match(/ORA-\d{5}/);
      return match?.[0] ?? null;
    }

    return null;
  }
}

export function buildMetasPeriodo(mes: string): MetasPeriodoDto {
  const match = mes.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new BadRequestException('mes debe tener formato YYYY-MM');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (
    year < 1900 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    (year === 9999 && month === 12)
  ) {
    throw new BadRequestException(
      'mes debe ser un periodo valido en formato YYYY-MM',
    );
  }

  return {
    mes: `${year}-${padTwoDigits(month)}`,
    fechaInicio: `${year}-${padTwoDigits(month)}-01`,
    fechaFin: formatUtcDate(new Date(Date.UTC(year, month, 0))),
    fechaFinMesAnterior: formatUtcDate(
      new Date(Date.UTC(year, month - 1, 0)),
    ),
  };
}

function formatUtcDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    padTwoDigits(date.getUTCMonth() + 1),
    padTwoDigits(date.getUTCDate()),
  ].join('-');
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

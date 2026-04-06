import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaginacionDto, PaginacionResponseDto } from './lotes.dto';
import { LotesEntity } from './lotes.entity';
import {
  captureQuerySnapshot,
  QueryDebugSnapshot,
} from '../common/query-performance.util';

type LotesResponse = PaginacionResponseDto<LotesEntity>;
type CacheEntry = {
  expiresAt: number;
  value: LotesResponse;
};

@Injectable()
export class LotesService {
  private readonly logger = new Logger(LotesService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<LotesResponse>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly logSlowSql: boolean;

  constructor(
    @InjectRepository(LotesEntity)
    private repo: Repository<LotesEntity>,
    private configService: ConfigService,
  ) {
    this.cacheTtlMs = this.parsePositiveNumber(
      this.configService.get('LOTES_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = this.parsePositiveNumber(
      this.configService.get('LOTES_CACHE_MAX_ITEMS'),
      200,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(dto: PaginacionDto): Promise<LotesResponse> {
    const startedAt = Date.now();
    const limite = Math.min(Math.max(dto.limite || 100, 1), 1000);
    const offset = Math.max(dto.offset || 0, 0);
    const incluirTotal = dto.incluirTotal === true;
    const pagina = Math.floor(offset / limite) + 1;
    const normalizedDto: PaginacionDto = {
      ...dto,
      limite,
      offset,
      incluirTotal,
    };

    const cacheKey = this.buildCacheKey(normalizedDto);
    const cached = this.getCache(cacheKey);
    if (cached) {
      this.logger.debug(
        `cache hit lotes limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join lotes limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return pending;
    }

    const loadPromise = (async () => {
      const qb = this.repo.createQueryBuilder('v');
      this.applyFilters(qb, normalizedDto);
      const dataQb = this.selectDataColumns(qb.clone());

      if (!incluirTotal) {
        const pagedDataQb = this.applyOrder(dataQb)
          .skip(offset)
          .take(limite + 1);
        const querySnapshots = [
          captureQuerySnapshot('data', pagedDataQb),
        ] as QueryDebugSnapshot[];
        const dataStartedAt = Date.now();
        const data = await pagedDataQb.getRawMany<LotesEntity>();
        const dataDurationMs = Date.now() - dataStartedAt;

        const tieneMas = data.length > limite;
        const response: LotesResponse = {
          data: data.slice(0, limite),
          total: null,
          limite,
          offset,
          pagina,
          totalPaginas: null,
          incluirTotal: false,
          tieneMas,
        };

        this.setCache(cacheKey, response);
        this.logSlowRequest({
          startedAt,
          dataDurationMs,
          countDurationMs: null,
          limite,
          offset,
          incluirTotal: false,
          rows: response.data.length,
          filters: this.countActiveFilters(normalizedDto),
          querySnapshots,
        });

        return response;
      }

      const countQb = qb.clone();
      const pagedDataQb = this.applyOrder(this.selectDataColumns(qb.clone()))
        .skip(offset)
        .take(limite);
      const querySnapshots = [
        captureQuerySnapshot('count', countQb),
        captureQuerySnapshot('data', pagedDataQb),
      ] as QueryDebugSnapshot[];

      const [countResult, dataResult] = await Promise.all([
        this.measureAsync(() => countQb.getCount()),
        this.measureAsync(() => pagedDataQb.getRawMany<LotesEntity>()),
      ]);
      const total = countResult.result;
      const data = dataResult.result;

      const response: LotesResponse = {
        data,
        total,
        limite,
        offset,
        pagina,
        totalPaginas: Math.ceil(total / limite),
        incluirTotal: true,
      };

      this.setCache(cacheKey, response);
      this.logSlowRequest({
        startedAt,
        dataDurationMs: dataResult.durationMs,
        countDurationMs: countResult.durationMs,
        limite,
        offset,
        incluirTotal: true,
        rows: response.data.length,
        filters: this.countActiveFilters(normalizedDto),
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

  private applyFilters(qb: SelectQueryBuilder<LotesEntity>, dto: PaginacionDto) {
    if (dto.idLote !== undefined) {
      qb.andWhere('v.idLote = :idLote', { idLote: dto.idLote });
    }

    if (dto.idFraccion !== undefined) {
      qb.andWhere('v.idFraccion = :idFraccion', { idFraccion: dto.idFraccion });
    }

    if (dto.idManzana !== undefined) {
      qb.andWhere('v.idManzana = :idManzana', { idManzana: dto.idManzana });
    }

    if (dto.idCliente !== undefined) {
      qb.andWhere('v.idCliente = :idCliente', { idCliente: dto.idCliente });
    }

    if (dto.idMoneda !== undefined) {
      qb.andWhere('v.idMoneda = :idMoneda', { idMoneda: dto.idMoneda });
    }

    if (dto.idEmpresa !== undefined) {
      qb.andWhere('v.idEmpresa = :idEmpresa', { idEmpresa: dto.idEmpresa });
    }

    if (dto.numeroContrato) {
      qb.andWhere('v.numeroContrato = :numeroContrato', {
        numeroContrato: dto.numeroContrato,
      });
    }

    if (dto.numeroTrato) {
      qb.andWhere('v.numeroTrato = :numeroTrato', {
        numeroTrato: dto.numeroTrato,
      });
    }

    if (dto.numeroLote) {
      qb.andWhere('v.numeroLote = :numeroLote', {
        numeroLote: dto.numeroLote,
      });
    }

    if (dto.cliente) {
      qb.andWhere('v.cliente = :cliente', { cliente: dto.cliente });
    }

    if (dto.docIdentCliente) {
      qb.andWhere('v.docIdentCliente = :docIdentCliente', {
        docIdentCliente: dto.docIdentCliente,
      });
    }

    if (dto.estado) {
      qb.andWhere('v.estado = :estado', { estado: dto.estado });
    }

    if (dto.sucursal) {
      qb.andWhere('v.sucursal = :sucursal', { sucursal: dto.sucursal });
    }

    if (dto.vendedor) {
      qb.andWhere('v.vendedor = :vendedor', { vendedor: dto.vendedor });
    }

    if (dto.ctaCteCtral) {
      qb.andWhere('v.ctaCteCtral = :ctaCteCtral', {
        ctaCteCtral: dto.ctaCteCtral,
      });
    }

    if (dto.nroFinca) {
      qb.andWhere('v.nroFinca = :nroFinca', { nroFinca: dto.nroFinca });
    }

    if (dto.rgpFolio) {
      qb.andWhere('v.rgpFolio = :rgpFolio', { rgpFolio: dto.rgpFolio });
    }

    if (dto.nroResolucionMunic) {
      qb.andWhere('v.nroResolucionMunic = :nroResolucionMunic', {
        nroResolucionMunic: dto.nroResolucionMunic,
      });
    }

    if (dto.observacion) {
      qb.andWhere('v.observacion = :observacion', {
        observacion: dto.observacion,
      });
    }

    if (dto.clienteObservacion) {
      qb.andWhere('v.clienteObservacion = :clienteObservacion', {
        clienteObservacion: dto.clienteObservacion,
      });
    }

    if (dto.nacionalidad) {
      qb.andWhere('v.nacionalidad = :nacionalidad', {
        nacionalidad: dto.nacionalidad,
      });
    }

    if (dto.pais) {
      qb.andWhere('v.pais = :pais', { pais: dto.pais });
    }

    if (dto.profesion) {
      qb.andWhere('v.profesion = :profesion', { profesion: dto.profesion });
    }

    if (dto.localidad) {
      qb.andWhere('v.localidad = :localidad', { localidad: dto.localidad });
    }

    if (dto.indCliente) {
      qb.andWhere('v.indCliente = :indCliente', {
        indCliente: dto.indCliente,
      });
    }

    if (dto.indProveedor) {
      qb.andWhere('v.indProveedor = :indProveedor', {
        indProveedor: dto.indProveedor,
      });
    }

    if (dto.indEmpleado) {
      qb.andWhere('v.indEmpleado = :indEmpleado', {
        indEmpleado: dto.indEmpleado,
      });
    }

    if (dto.lugarTrabajo) {
      qb.andWhere('v.lugarTrabajo = :lugarTrabajo', {
        lugarTrabajo: dto.lugarTrabajo,
      });
    }

    if (dto.situacion) {
      qb.andWhere('v.situacion = :situacion', {
        situacion: dto.situacion,
      });
    }

    if (dto.plazoDesde !== undefined) {
      qb.andWhere('v.plazo >= :plazoDesde', {
        plazoDesde: dto.plazoDesde,
      });
    }

    if (dto.plazoHasta !== undefined) {
      qb.andWhere('v.plazo <= :plazoHasta', {
        plazoHasta: dto.plazoHasta,
      });
    }

    if (dto.costoLoteDesde !== undefined) {
      qb.andWhere('v.costoLote >= :costoLoteDesde', {
        costoLoteDesde: dto.costoLoteDesde,
      });
    }

    if (dto.costoLoteHasta !== undefined) {
      qb.andWhere('v.costoLote <= :costoLoteHasta', {
        costoLoteHasta: dto.costoLoteHasta,
      });
    }

    if (dto.montoCuotaDesde !== undefined) {
      qb.andWhere('v.montoCuota >= :montoCuotaDesde', {
        montoCuotaDesde: dto.montoCuotaDesde,
      });
    }

    if (dto.montoCuotaHasta !== undefined) {
      qb.andWhere('v.montoCuota <= :montoCuotaHasta', {
        montoCuotaHasta: dto.montoCuotaHasta,
      });
    }

    if (dto.totalPagadoDesde !== undefined) {
      qb.andWhere('v.totalPagado >= :totalPagadoDesde', {
        totalPagadoDesde: dto.totalPagadoDesde,
      });
    }

    if (dto.totalPagadoHasta !== undefined) {
      qb.andWhere('v.totalPagado <= :totalPagadoHasta', {
        totalPagadoHasta: dto.totalPagadoHasta,
      });
    }

    if (dto.saldoDeudorDesde !== undefined) {
      qb.andWhere('v.saldoDeudor >= :saldoDeudorDesde', {
        saldoDeudorDesde: dto.saldoDeudorDesde,
      });
    }

    if (dto.saldoDeudorHasta !== undefined) {
      qb.andWhere('v.saldoDeudor <= :saldoDeudorHasta', {
        saldoDeudorHasta: dto.saldoDeudorHasta,
      });
    }

    if (dto.porcentajeMoraDesde !== undefined) {
      qb.andWhere('v.porcentajeMora >= :porcentajeMoraDesde', {
        porcentajeMoraDesde: dto.porcentajeMoraDesde,
      });
    }

    if (dto.porcentajeMoraHasta !== undefined) {
      qb.andWhere('v.porcentajeMora <= :porcentajeMoraHasta', {
        porcentajeMoraHasta: dto.porcentajeMoraHasta,
      });
    }

    if (dto.fechaContratoDesde) {
      qb.andWhere(
        "v.fechaContrato >= TO_DATE(:fechaContratoDesde, 'YYYY-MM-DD')",
        { fechaContratoDesde: dto.fechaContratoDesde },
      );
    }

    if (dto.fechaContratoHasta) {
      qb.andWhere(
        "v.fechaContrato < TO_DATE(:fechaContratoHasta, 'YYYY-MM-DD') + 1",
        { fechaContratoHasta: dto.fechaContratoHasta },
      );
    }

    if (dto.fechaUltimoPagoDesde) {
      qb.andWhere(
        "v.fechaUltimoPago >= TO_DATE(:fechaUltimoPagoDesde, 'YYYY-MM-DD')",
        { fechaUltimoPagoDesde: dto.fechaUltimoPagoDesde },
      );
    }

    if (dto.fechaUltimoPagoHasta) {
      qb.andWhere(
        "v.fechaUltimoPago < TO_DATE(:fechaUltimoPagoHasta, 'YYYY-MM-DD') + 1",
        { fechaUltimoPagoHasta: dto.fechaUltimoPagoHasta },
      );
    }

    if (dto.fechaIncripcionMunicDesde) {
      qb.andWhere(
        "v.fechaIncripcionMunic >= TO_DATE(:fechaIncripcionMunicDesde, 'YYYY-MM-DD')",
        { fechaIncripcionMunicDesde: dto.fechaIncripcionMunicDesde },
      );
    }

    if (dto.fechaIncripcionMunicHasta) {
      qb.andWhere(
        "v.fechaIncripcionMunic < TO_DATE(:fechaIncripcionMunicHasta, 'YYYY-MM-DD') + 1",
        { fechaIncripcionMunicHasta: dto.fechaIncripcionMunicHasta },
      );
    }

    if (dto.fechaVentaDesde) {
      qb.andWhere("v.fechaVenta >= TO_DATE(:fechaVentaDesde, 'YYYY-MM-DD')", {
        fechaVentaDesde: dto.fechaVentaDesde,
      });
    }

    if (dto.fechaVentaHasta) {
      qb.andWhere("v.fechaVenta < TO_DATE(:fechaVentaHasta, 'YYYY-MM-DD') + 1", {
        fechaVentaHasta: dto.fechaVentaHasta,
      });
    }
  }

  private applyOrder(qb: SelectQueryBuilder<LotesEntity>) {
    return qb
      .orderBy('v.idFraccion', 'ASC')
      .addOrderBy('v.idManzana', 'ASC')
      .addOrderBy('v.numeroLote', 'ASC')
      .addOrderBy('v.idLote', 'ASC');
  }

  private selectDataColumns(qb: SelectQueryBuilder<LotesEntity>) {
    return qb
      .select('v.idLote', 'idLote')
      .addSelect('v.idFraccion', 'idFraccion')
      .addSelect('v.idManzana', 'idManzana')
      .addSelect('v.idCliente', 'idCliente')
      .addSelect('v.costoLote', 'costoLote')
      .addSelect('v.ctaCteCtral', 'ctaCteCtral')
      .addSelect('v.dimension', 'dimension')
      .addSelect('v.dimensionEste', 'dimensionEste')
      .addSelect('v.dimensionNorte', 'dimensionNorte')
      .addSelect('v.dimensionOeste', 'dimensionOeste')
      .addSelect('v.dimensionSur', 'dimensionSur')
      .addSelect('v.estado', 'estado')
      .addSelect('v.linderoEste', 'linderoEste')
      .addSelect('v.linderoNorte', 'linderoNorte')
      .addSelect('v.linderoOeste', 'linderoOeste')
      .addSelect('v.linderoSur', 'linderoSur')
      .addSelect('v.montoCuota', 'montoCuota')
      .addSelect('v.nroFinca', 'nroFinca')
      .addSelect('v.numeroContrato', 'numeroContrato')
      .addSelect('v.fechaContrato', 'fechaContrato')
      .addSelect('v.numeroTrato', 'numeroTrato')
      .addSelect('v.vendedor', 'vendedor')
      .addSelect('v.plazo', 'plazo')
      .addSelect('v.sucursal', 'sucursal')
      .addSelect('v.observacion', 'observacion')
      .addSelect('v.precioContado', 'precioContado')
      .addSelect('v.precioFinanciado', 'precioFinanciado')
      .addSelect('v.precioVentaFinal', 'precioVentaFinal')
      .addSelect('v.totalPagado', 'totalPagado')
      .addSelect('v.saldoDeudor', 'saldoDeudor')
      .addSelect('v.ultimaCuotaPagada', 'ultimaCuotaPagada')
      .addSelect('v.fechaUltimoPago', 'fechaUltimoPago')
      .addSelect('v.porcentajeMora', 'porcentajeMora')
      .addSelect('v.idMoneda', 'idMoneda')
      .addSelect('v.rgpFolio', 'rgpFolio')
      .addSelect('v.rgpAnioIncripcion', 'rgpAnioIncripcion')
      .addSelect('v.fechaIncripcionMunic', 'fechaIncripcionMunic')
      .addSelect('v.fechaVenta', 'fechaVenta')
      .addSelect('v.nroResolucionMunic', 'nroResolucionMunic')
      .addSelect('v.idEmpresa', 'idEmpresa')
      .addSelect('v.numeroLote', 'numeroLote')
      .addSelect('v.cliente', 'cliente')
      .addSelect('v.docIdentCliente', 'docIdentCliente')
      .addSelect('v.indCliente', 'indCliente')
      .addSelect('v.indProveedor', 'indProveedor')
      .addSelect('v.indEmpleado', 'indEmpleado')
      .addSelect('v.profesion', 'profesion')
      .addSelect('v.lugarTrabajo', 'lugarTrabajo')
      .addSelect('v.situacion', 'situacion')
      .addSelect('v.nacionalidad', 'nacionalidad')
      .addSelect('v.pais', 'pais')
      .addSelect('v.clienteObservacion', 'clienteObservacion')
      .addSelect('v.localidad', 'localidad');
  }

  private getCache(key: string): LotesResponse | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  private setCache(key: string, value: LotesResponse) {
    if (this.cacheTtlMs <= 0) {
      return;
    }

    this.pruneCache();
    this.cache.set(key, {
      expiresAt: Date.now() + this.cacheTtlMs,
      value,
    });
  }

  private pruneCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }

    while (this.cache.size >= this.cacheMaxItems) {
      const firstKey = this.cache.keys().next().value;
      if (!firstKey) {
        break;
      }
      this.cache.delete(firstKey);
    }
  }

  private buildCacheKey(dto: PaginacionDto): string {
    return JSON.stringify(
      Object.keys(dto)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          const value = dto[key as keyof PaginacionDto];
          if (value !== undefined) {
            acc[key] = value;
          }
          return acc;
        }, {}),
    );
  }

  private countActiveFilters(dto: PaginacionDto): number {
    return Object.entries(dto).filter(([key, value]) => {
      return (
        !['limite', 'offset', 'incluirTotal'].includes(key) &&
        value !== undefined &&
        value !== ''
      );
    }).length;
  }

  private async measureAsync<T>(
    fn: () => Promise<T>,
  ): Promise<{ result: T; durationMs: number }> {
    const startedAt = Date.now();
    const result = await fn();
    return {
      result,
      durationMs: Date.now() - startedAt,
    };
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
      `findAll lotes lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} offset=${input.offset} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql lotes ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }

  private parsePositiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}

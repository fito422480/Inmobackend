import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaginacionDto, PaginacionResponseDto } from './clientes.dto';
import { ClientesEntity } from './clientes.entity';
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

type ClientesResponse = PaginacionResponseDto<ClientesEntity>;

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);
  private readonly cache = new Map<string, CacheEntry<ClientesResponse>>();
  private readonly inFlight = new Map<string, Promise<ClientesResponse>>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxItems: number;
  private readonly logSlowSql: boolean;

  constructor(
    @InjectRepository(ClientesEntity)
    private repo: Repository<ClientesEntity>,
    private configService: ConfigService,
  ) {
    this.cacheTtlMs = parsePositiveNumber(
      this.configService.get('CLIENTES_CACHE_TTL_MS'),
      15000,
    );
    this.cacheMaxItems = parsePositiveNumber(
      this.configService.get('CLIENTES_CACHE_MAX_ITEMS'),
      200,
    );
    this.logSlowSql = this.configService.get('LOG_SLOW_SQL') === 'true';
  }

  async findAll(dto: PaginacionDto): Promise<ClientesResponse> {
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
    const normalizedDtoRecord = normalizedDto as unknown as Record<
      string,
      unknown
    >;

    const cacheKey = buildStableCacheKey(normalizedDtoRecord);
    const cached = getCacheValue(this.cache, cacheKey);
    if (cached) {
      this.logger.debug(
        `cache hit clientes limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return cached;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      this.logger.debug(
        `cache join clientes limite=${limite} offset=${offset} incluirTotal=${incluirTotal}`,
      );
      return pending;
    }

    const loadPromise = (async () => {
      const qb = this.repo.createQueryBuilder('v');
      this.applyFilters(qb, normalizedDto);
      const dataQb = this.selectDataColumns(qb.clone(), limite + 1);

      if (!incluirTotal) {
        const pagedDataQb = this.applyOrder(dataQb)
          .skip(offset)
          .take(limite + 1);
        const querySnapshots = [
          captureQuerySnapshot('data', pagedDataQb),
        ] as QueryDebugSnapshot[];
        const dataResult = await measureAsync(() =>
          pagedDataQb.getRawMany<ClientesEntity>(),
        );

        const tieneMas = dataResult.result.length > limite;
        const response: ClientesResponse = {
          data: dataResult.result.slice(0, limite),
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
        measureAsync(() => pagedDataQb.getRawMany<ClientesEntity>()),
      ]);

      const response: ClientesResponse = {
        data: dataResult.result,
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
    } finally {
      if (this.inFlight.get(cacheKey) === loadPromise) {
        this.inFlight.delete(cacheKey);
      }
    }
  }

  private applyFilters(
    qb: SelectQueryBuilder<ClientesEntity>,
    dto: PaginacionDto,
  ) {
    if (dto.idPersona !== undefined) {
      qb.andWhere('v.idPersona = :idPersona', { idPersona: dto.idPersona });
    }

    if (dto.numeroContrato) {
      qb.andWhere('v.numeroContrato = :numeroContrato', {
        numeroContrato: dto.numeroContrato,
      });
    }

    if (dto.documento) {
      qb.andWhere('v.documento = :documento', { documento: dto.documento });
    }

    if (dto.ruc) {
      qb.andWhere('v.ruc = :ruc', { ruc: dto.ruc });
    }

    if (dto.nombreCompleto) {
      qb.andWhere('v.nombreCompleto = :nombreCompleto', {
        nombreCompleto: dto.nombreCompleto,
      });
    }

    if (dto.primerNombre) {
      qb.andWhere('v.primerNombre = :primerNombre', {
        primerNombre: dto.primerNombre,
      });
    }

    if (dto.primerApellido) {
      qb.andWhere('v.primerApellido = :primerApellido', {
        primerApellido: dto.primerApellido,
      });
    }

    if (dto.estado) {
      qb.andWhere('v.estado = :estado', { estado: dto.estado });
    }

    if (dto.estadoCivil) {
      qb.andWhere('v.estadoCivil = :estadoCivil', {
        estadoCivil: dto.estadoCivil,
      });
    }

    if (dto.nacionalidad) {
      qb.andWhere('v.nacionalidad = :nacionalidad', {
        nacionalidad: dto.nacionalidad,
      });
    }

    if (dto.sexo) {
      qb.andWhere('v.sexo = :sexo', { sexo: dto.sexo });
    }

    if (dto.tipoDocumento) {
      qb.andWhere('v.tipoDocumento = :tipoDocumento', {
        tipoDocumento: dto.tipoDocumento,
      });
    }

    if (dto.barrio) {
      qb.andWhere('v.barrio = :barrio', { barrio: dto.barrio });
    }

    if (dto.sucursal) {
      qb.andWhere('v.sucursal = :sucursal', { sucursal: dto.sucursal });
    }

    if (dto.pais) {
      qb.andWhere('v.pais = :pais', { pais: dto.pais });
    }

    if (dto.profesion) {
      qb.andWhere('v.profesion = :profesion', { profesion: dto.profesion });
    }

    if (dto.departamento) {
      qb.andWhere('v.departamento = :departamento', {
        departamento: dto.departamento,
      });
    }

    if (dto.distrito) {
      qb.andWhere('v.distrito = :distrito', { distrito: dto.distrito });
    }

    if (dto.localidad) {
      qb.andWhere('v.localidad = :localidad', { localidad: dto.localidad });
    }

    if (dto.estadoContrato) {
      qb.andWhere('v.estadoContrato = :estadoContrato', {
        estadoContrato: dto.estadoContrato,
      });
    }

    if (dto.vendedor) {
      qb.andWhere('v.vendedor = :vendedor', { vendedor: dto.vendedor });
    }

    if (dto.condominio) {
      qb.andWhere('v.condominio = :condominio', {
        condominio: dto.condominio,
      });
    }

    if (dto.recuperado) {
      qb.andWhere('v.recuperado = :recuperado', {
        recuperado: dto.recuperado,
      });
    }

    if (dto.refinanciacion) {
      qb.andWhere('v.refinanciacion = :refinanciacion', {
        refinanciacion: dto.refinanciacion,
      });
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

    if (dto.informconf) {
      qb.andWhere('v.informconf = :informconf', {
        informconf: dto.informconf,
      });
    }

    if (dto.idLote !== undefined) {
      qb.andWhere('v.idLote = :idLote', { idLote: dto.idLote });
    }

    if (dto.idFraccion !== undefined) {
      qb.andWhere('v.idFraccion = :idFraccion', {
        idFraccion: dto.idFraccion,
      });
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

    if (dto.fechaIngresoDesde) {
      qb.andWhere(
        "v.fechaIngreso >= TO_DATE(:fechaIngresoDesde, 'YYYY-MM-DD')",
        { fechaIngresoDesde: dto.fechaIngresoDesde },
      );
    }

    if (dto.fechaIngresoHasta) {
      qb.andWhere(
        "v.fechaIngreso < TO_DATE(:fechaIngresoHasta, 'YYYY-MM-DD') + 1",
        { fechaIngresoHasta: dto.fechaIngresoHasta },
      );
    }

    if (dto.fechaNacimientoDesde) {
      qb.andWhere(
        "v.fechaNacimiento >= TO_DATE(:fechaNacimientoDesde, 'YYYY-MM-DD')",
        { fechaNacimientoDesde: dto.fechaNacimientoDesde },
      );
    }

    if (dto.fechaNacimientoHasta) {
      qb.andWhere(
        "v.fechaNacimiento < TO_DATE(:fechaNacimientoHasta, 'YYYY-MM-DD') + 1",
        { fechaNacimientoHasta: dto.fechaNacimientoHasta },
      );
    }

    if (dto.fechaPrimeraVentaDesde) {
      qb.andWhere(
        "v.fechaPrimeraVenta >= TO_DATE(:fechaPrimeraVentaDesde, 'YYYY-MM-DD')",
        { fechaPrimeraVentaDesde: dto.fechaPrimeraVentaDesde },
      );
    }

    if (dto.fechaPrimeraVentaHasta) {
      qb.andWhere(
        "v.fechaPrimeraVenta < TO_DATE(:fechaPrimeraVentaHasta, 'YYYY-MM-DD') + 1",
        { fechaPrimeraVentaHasta: dto.fechaPrimeraVentaHasta },
      );
    }

    if (dto.fechaBajaDesde) {
      qb.andWhere("v.fechaBaja >= TO_DATE(:fechaBajaDesde, 'YYYY-MM-DD')", {
        fechaBajaDesde: dto.fechaBajaDesde,
      });
    }

    if (dto.fechaBajaHasta) {
      qb.andWhere("v.fechaBaja < TO_DATE(:fechaBajaHasta, 'YYYY-MM-DD') + 1", {
        fechaBajaHasta: dto.fechaBajaHasta,
      });
    }
  }

  private applyOrder(qb: SelectQueryBuilder<ClientesEntity>) {
    return qb
      .orderBy('v.nombreCompleto', 'ASC')
      .addOrderBy('v.idPersona', 'ASC')
      .addOrderBy('v.numeroContrato', 'ASC');
  }

  private selectDataColumns(
    qb: SelectQueryBuilder<ClientesEntity>,
    firstRowsHint?: number,
  ) {
    return qb
      .select(
        withOracleFirstRowsHint('v.idPersona', firstRowsHint),
        'idPersona',
      )
      .addSelect('v.direccionEmail', 'direccionEmail')
      .addSelect('v.direccionParticular', 'direccionParticular')
      .addSelect('v.documento', 'documento')
      .addSelect('v.estado', 'estado')
      .addSelect('v.estadoCivil', 'estadoCivil')
      .addSelect('v.fechaBaja', 'fechaBaja')
      .addSelect('v.fechaIngreso', 'fechaIngreso')
      .addSelect('v.fechaNacimiento', 'fechaNacimiento')
      .addSelect('v.fechaPrimeraVenta', 'fechaPrimeraVenta')
      .addSelect('v.nacionalidad', 'nacionalidad')
      .addSelect('v.nombreCompleto', 'nombreCompleto')
      .addSelect('v.observacion', 'observacion')
      .addSelect('v.primerApellido', 'primerApellido')
      .addSelect('v.primerNombre', 'primerNombre')
      .addSelect('v.ruc', 'ruc')
      .addSelect('v.segundoApellido', 'segundoApellido')
      .addSelect('v.segundoNombre', 'segundoNombre')
      .addSelect('v.sexo', 'sexo')
      .addSelect('v.telefonoOficina', 'telefonoOficina')
      .addSelect('v.telefonoParticular', 'telefonoParticular')
      .addSelect('v.tipoDocumento', 'tipoDocumento')
      .addSelect('v.referenciaDireccion', 'referenciaDireccion')
      .addSelect('v.barrio', 'barrio')
      .addSelect('v.informconf', 'informconf')
      .addSelect('v.indCliente', 'indCliente')
      .addSelect('v.indProveedor', 'indProveedor')
      .addSelect('v.indEmpleado', 'indEmpleado')
      .addSelect('v.lugarTrabajo', 'lugarTrabajo')
      .addSelect('v.situacion', 'situacion')
      .addSelect('v.direccion', 'direccion')
      .addSelect('v.sucursal', 'sucursal')
      .addSelect('v.pais', 'pais')
      .addSelect('v.profesion', 'profesion')
      .addSelect('v.departamento', 'departamento')
      .addSelect('v.distrito', 'distrito')
      .addSelect('v.localidad', 'localidad')
      .addSelect('v.numeroContrato', 'numeroContrato')
      .addSelect('v.estadoContrato', 'estadoContrato')
      .addSelect('v.vendedor', 'vendedor')
      .addSelect('v.condominio', 'condominio')
      .addSelect('v.planPagoVendedor', 'planPagoVendedor')
      .addSelect('v.idLote', 'idLote')
      .addSelect('v.idFraccion', 'idFraccion')
      .addSelect('v.nombreFraccion', 'nombreFraccion')
      .addSelect('v.recuperado', 'recuperado')
      .addSelect('v.refinanciacion', 'refinanciacion')
      .addSelect('v.mesesAtraso', 'mesesAtraso')
      .addSelect('v.montoCuota', 'montoCuota');
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
      `findAll clientes lento total=${totalDurationMs}ms data=${input.dataDurationMs}ms count=${input.countDurationMs ?? 0}ms limite=${input.limite} offset=${input.offset} incluirTotal=${input.incluirTotal} rows=${input.rows} filters=${input.filters}`,
    );

    if (this.logSlowSql && input.querySnapshots?.length) {
      for (const snapshot of input.querySnapshots) {
        this.logger.warn(
          `slow-sql clientes ${snapshot.label} sql=${snapshot.sql} params=${JSON.stringify(snapshot.parameters)}`,
        );
      }
    }
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaginacionDto, PaginacionResponseDto } from './clientes.dto';
import { ClientesEntity } from './clientes.entity';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(ClientesEntity)
    private repo: Repository<ClientesEntity>,
  ) {}

  async findAll(
    dto: PaginacionDto,
  ): Promise<PaginacionResponseDto<ClientesEntity>> {
    const limite = Math.min(Math.max(dto.limite || 100, 1), 1000);
    const offset = Math.max(dto.offset || 0, 0);
    const incluirTotal = dto.incluirTotal !== false;
    const pagina = Math.floor(offset / limite) + 1;

    const qb = this.repo.createQueryBuilder('v');
    this.applyFilters(qb, dto);
    const dataQb = this.selectDataColumns(qb.clone());

    if (!incluirTotal) {
      const data = await this.applyOrder(dataQb)
        .skip(offset)
        .take(limite + 1)
        .getRawMany<ClientesEntity>();

      const tieneMas = data.length > limite;

      return {
        data: data.slice(0, limite),
        total: null,
        limite,
        offset,
        pagina,
        totalPaginas: null,
        incluirTotal: false,
        tieneMas,
      };
    }

    const [total, data] = await Promise.all([
      qb.clone().getCount(),
      this.applyOrder(this.selectDataColumns(qb.clone()))
        .skip(offset)
        .take(limite)
        .getRawMany<ClientesEntity>(),
    ]);

    return {
      data,
      total,
      limite,
      offset,
      pagina,
      totalPaginas: Math.ceil(total / limite),
      incluirTotal: true,
    };
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

  private selectDataColumns(qb: SelectQueryBuilder<ClientesEntity>) {
    return qb
      .select('v.idPersona', 'idPersona')
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
}

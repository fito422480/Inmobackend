import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaginacionDto, PaginacionResponseDto } from './lotes.dto';
import { LotesEntity } from './lotes.entity';

@Injectable()
export class LotesService {
  constructor(
    @InjectRepository(LotesEntity)
    private repo: Repository<LotesEntity>,
  ) {}

  async findAll(
    dto: PaginacionDto,
  ): Promise<PaginacionResponseDto<LotesEntity>> {
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
        .getRawMany<LotesEntity>();

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
        .getRawMany<LotesEntity>(),
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
}

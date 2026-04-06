import { Controller, Get, Query } from '@nestjs/common';
import { LotesService } from './lotes.service';

@Controller('lotes')
export class LotesController {
  constructor(private service: LotesService) {}

  /**
   * GET /lotes
   *
   * Query params:
   *   limit|limite          número de registros por página (default: 100, max: 1000)
   *   offset                desde qué registro empezar (default: 0)
   *   idLote                filtrar por ID_LOTE
   *   idFraccion            filtrar por ID_FRACCION
   *   idManzana             filtrar por ID_MANZANA
   *   idCliente             filtrar por ID_CLIENTE
   *   numeroContrato        filtrar por NUMERO_CONTRATO
   *   numeroTrato           filtrar por NUMERO_TRATO
   *   numeroLote            filtrar por NUMERO_LOTE
   *   cliente               filtrar por CLIENTE
   *   docIdentCliente       filtrar por DOC_IDENT_CLIENTE
   *   estado                filtrar por ESTADO
   *   sucursal              filtrar por SUCURSAL
   *   vendedor              filtrar por VENDEDOR
   *   idMoneda              filtrar por ID_MONEDA
   *   idEmpresa             filtrar por ID_EMPRESA
   *   indCliente            filtrar por IND_CLIENTE
   *   indProveedor          filtrar por IND_PROVEEDOR
   *   indEmpleado           filtrar por IND_EMPLEADO
   *   profesion             filtrar por PROFESION
   *   lugarTrabajo          filtrar por LUGAR_TRABAJO
   *   situacion             filtrar por SITUACION
   *   nacionalidad          filtrar por NACIONALIDAD
   *   pais                  filtrar por PAIS
   *   localidad             filtrar por LOCALIDAD
   *   costoLoteDesde/Hasta  filtrar COSTO_LOTE
   *   montoCuotaDesde/Hasta filtrar MONTO_CUOTA
   *   totalPagadoDesde/Hasta filtrar TOTAL_PAGADO
   *   saldoDeudorDesde/Hasta filtrar SALDO_DEUDOR
   *   porcentajeMoraDesde/Hasta filtrar PORCENTAJE_MORA
   *   fechaContratoDesde/Hasta filtrar FECHA_CONTRATO
   *   fechaUltimoPagoDesde/Hasta filtrar FECHA_ULTIMO_PAGO
   *   fechaIncripcionMunicDesde/Hasta filtrar FECHA_INCRIPCION_MUNIC
   *   fechaVentaDesde/Hasta filtrar FECHA_VENTA
   *   incluirTotal         true|false (default: false para evitar COUNT(*) en vistas grandes)
   *
   * Ejemplos:
   *   GET /lotes?limite=100&offset=0
   *   GET /lotes?idLote=1234
   *   GET /lotes?numeroContrato=00012345&limite=50&offset=0
   *   GET /lotes?idFraccion=10&idManzana=4&sucursal=CDE&limite=100&offset=0
   *   GET /lotes?cliente=JUAN%20PEREZ&docIdentCliente=1234567&limite=20&offset=0
   */
  @Get()
  findAll(
    @Query('limit') limit: string,
    @Query('limite') limite: string,
    @Query('offset') offset: string,
    @Query('idLote') idLote?: string,
    @Query('idFraccion') idFraccion?: string,
    @Query('idManzana') idManzana?: string,
    @Query('idCliente') idCliente?: string,
    @Query('idMoneda') idMoneda?: string,
    @Query('idEmpresa') idEmpresa?: string,
    @Query('numeroContrato') numeroContrato?: string,
    @Query('numeroTrato') numeroTrato?: string,
    @Query('numeroLote') numeroLote?: string,
    @Query('cliente') cliente?: string,
    @Query('docIdentCliente') docIdentCliente?: string,
    @Query('estado') estado?: string,
    @Query('sucursal') sucursal?: string,
    @Query('vendedor') vendedor?: string,
    @Query('ctaCteCtral') ctaCteCtral?: string,
    @Query('nroFinca') nroFinca?: string,
    @Query('rgpFolio') rgpFolio?: string,
    @Query('nroResolucionMunic') nroResolucionMunic?: string,
    @Query('observacion') observacion?: string,
    @Query('clienteObservacion') clienteObservacion?: string,
    @Query('nacionalidad') nacionalidad?: string,
    @Query('pais') pais?: string,
    @Query('profesion') profesion?: string,
    @Query('localidad') localidad?: string,
    @Query('indCliente') indCliente?: string,
    @Query('indProveedor') indProveedor?: string,
    @Query('indEmpleado') indEmpleado?: string,
    @Query('lugarTrabajo') lugarTrabajo?: string,
    @Query('situacion') situacion?: string,
    @Query('plazoDesde') plazoDesde?: string,
    @Query('plazoHasta') plazoHasta?: string,
    @Query('costoLoteDesde') costoLoteDesde?: string,
    @Query('costoLoteHasta') costoLoteHasta?: string,
    @Query('montoCuotaDesde') montoCuotaDesde?: string,
    @Query('montoCuotaHasta') montoCuotaHasta?: string,
    @Query('totalPagadoDesde') totalPagadoDesde?: string,
    @Query('totalPagadoHasta') totalPagadoHasta?: string,
    @Query('saldoDeudorDesde') saldoDeudorDesde?: string,
    @Query('saldoDeudorHasta') saldoDeudorHasta?: string,
    @Query('porcentajeMoraDesde') porcentajeMoraDesde?: string,
    @Query('porcentajeMoraHasta') porcentajeMoraHasta?: string,
    @Query('fechaContratoDesde') fechaContratoDesde?: string,
    @Query('fechaContratoHasta') fechaContratoHasta?: string,
    @Query('fechaUltimoPagoDesde') fechaUltimoPagoDesde?: string,
    @Query('fechaUltimoPagoHasta') fechaUltimoPagoHasta?: string,
    @Query('fechaIncripcionMunicDesde') fechaIncripcionMunicDesde?: string,
    @Query('fechaIncripcionMunicHasta') fechaIncripcionMunicHasta?: string,
    @Query('fechaVentaDesde') fechaVentaDesde?: string,
    @Query('fechaVentaHasta') fechaVentaHasta?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    return this.service.findAll({
      limite: parseInt(limit || limite) || 100,
      offset: parseInt(offset) || 0,
      incluirTotal: this.parseBoolean(incluirTotal),
      idLote: this.parseOptionalNumber(idLote),
      idFraccion: this.parseOptionalNumber(idFraccion),
      idManzana: this.parseOptionalNumber(idManzana),
      idCliente: this.parseOptionalNumber(idCliente),
      idMoneda: this.parseOptionalNumber(idMoneda),
      idEmpresa: this.parseOptionalNumber(idEmpresa),
      numeroContrato,
      numeroTrato,
      numeroLote,
      cliente,
      docIdentCliente,
      estado,
      sucursal,
      vendedor,
      ctaCteCtral,
      nroFinca,
      rgpFolio,
      nroResolucionMunic,
      observacion,
      clienteObservacion,
      nacionalidad,
      pais,
      profesion,
      localidad,
      indCliente,
      indProveedor,
      indEmpleado,
      lugarTrabajo,
      situacion,
      plazoDesde: this.parseOptionalNumber(plazoDesde),
      plazoHasta: this.parseOptionalNumber(plazoHasta),
      costoLoteDesde: this.parseOptionalNumber(costoLoteDesde),
      costoLoteHasta: this.parseOptionalNumber(costoLoteHasta),
      montoCuotaDesde: this.parseOptionalNumber(montoCuotaDesde),
      montoCuotaHasta: this.parseOptionalNumber(montoCuotaHasta),
      totalPagadoDesde: this.parseOptionalNumber(totalPagadoDesde),
      totalPagadoHasta: this.parseOptionalNumber(totalPagadoHasta),
      saldoDeudorDesde: this.parseOptionalNumber(saldoDeudorDesde),
      saldoDeudorHasta: this.parseOptionalNumber(saldoDeudorHasta),
      porcentajeMoraDesde: this.parseOptionalNumber(porcentajeMoraDesde),
      porcentajeMoraHasta: this.parseOptionalNumber(porcentajeMoraHasta),
      fechaContratoDesde,
      fechaContratoHasta,
      fechaUltimoPagoDesde,
      fechaUltimoPagoHasta,
      fechaIncripcionMunicDesde,
      fechaIncripcionMunicHasta,
      fechaVentaDesde,
      fechaVentaHasta,
    });
  }

  private parseBoolean(value?: string): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }

    return !['0', 'false', 'no'].includes(value.toLowerCase());
  }

  private parseOptionalNumber(value?: string): number | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}

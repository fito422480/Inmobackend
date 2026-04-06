import { Controller, Get, Query } from '@nestjs/common';
import { ClientesService } from './clientes.service';

@Controller('clientes')
export class ClientesController {
  constructor(private service: ClientesService) {}

  /**
   * GET /clientes
   *
   * Query params:
   *   limit|limite         número de registros por página (default: 100, max: 1000)
   *   offset               desde qué registro empezar (default: 0)
   *   idPersona            filtrar por ID_PERSONA
   *   documento            filtrar por DOCUMENTO
   *   ruc                  filtrar por RUC
   *   nombreCompleto       filtrar por NOMBRE_COMPLETO
   *   primerNombre         filtrar por PRIMER_NOMBRE
   *   primerApellido       filtrar por PRIMER_APELLIDO
   *   estado               filtrar por ESTADO
   *   estadoCivil          filtrar por ESTADO_CIVIL
   *   nacionalidad         filtrar por NACIONALIDAD
   *   sexo                 filtrar por SEXO
   *   tipoDocumento        filtrar por TIPO_DOCUMENTO
   *   barrio               filtrar por BARRIO
   *   sucursal             filtrar por SUCURSAL
   *   pais                 filtrar por PAIS
   *   profesion            filtrar por PROFESION
   *   departamento         filtrar por DEPARTAMENTO
   *   distrito             filtrar por DISTRITO
   *   localidad            filtrar por LOCALIDAD
   *   numeroContrato      filtrar por contrato
   *   estadoContrato      filtrar por ESTADO_CONTRATO
   *   vendedor            filtrar por VENDEDOR
   *   condominio          filtrar por CONDOMINIO
   *   recuperado          filtrar por RECUPERADO
   *   refinanciacion      filtrar por REFINANCIACION
   *   indCliente          filtrar por IND_CLIENTE
   *   indProveedor        filtrar por IND_PROVEEDOR
   *   indEmpleado         filtrar por IND_EMPLEDO
   *   informconf          filtrar por INFORMCONF
   *   idLote              filtrar por ID_LOTE
   *   idFraccion          filtrar por ID_FRACCION
   *   mesesAtrasoDesde    filtrar MESES_ATRASO >= valor
   *   mesesAtrasoHasta    filtrar MESES_ATRASO <= valor
   *   fechaIngresoDesde   filtrar FECHA_INGRESO >= (YYYY-MM-DD)
   *   fechaIngresoHasta   filtrar FECHA_INGRESO <= (YYYY-MM-DD)
   *   fechaNacimientoDesde filtrar FECHA_NACIMIENTO >= (YYYY-MM-DD)
   *   fechaNacimientoHasta filtrar FECHA_NACIMIENTO <= (YYYY-MM-DD)
   *   fechaPrimeraVentaDesde filtrar FECHA_PRIMERA_VENTA >= (YYYY-MM-DD)
   *   fechaPrimeraVentaHasta filtrar FECHA_PRIMERA_VENTA <= (YYYY-MM-DD)
   *   fechaBajaDesde      filtrar FECHA_BAJA >= (YYYY-MM-DD)
   *   fechaBajaHasta      filtrar FECHA_BAJA <= (YYYY-MM-DD)
   *   incluirTotal        true|false (default: false para evitar COUNT(*) en vistas grandes)
   *
   * Ejemplos:
   *   GET /clientes?limite=100&offset=0
   *   GET /clientes?documento=1234567&limite=100&offset=0
   *   GET /clientes?numeroContrato=00012345&limite=100&offset=0
   *   GET /clientes?sucursal=CDE&estadoContrato=ACTIVO&limite=100&offset=0
   */
  @Get()
  findAll(
    @Query('limit') limit: string,
    @Query('limite') limite: string,
    @Query('offset') offset: string,
    @Query('idPersona') idPersona?: string,
    @Query('numeroContrato') numeroContrato?: string,
    @Query('documento') documento?: string,
    @Query('ruc') ruc?: string,
    @Query('nombreCompleto') nombreCompleto?: string,
    @Query('primerNombre') primerNombre?: string,
    @Query('primerApellido') primerApellido?: string,
    @Query('estado') estado?: string,
    @Query('estadoCivil') estadoCivil?: string,
    @Query('nacionalidad') nacionalidad?: string,
    @Query('sexo') sexo?: string,
    @Query('tipoDocumento') tipoDocumento?: string,
    @Query('barrio') barrio?: string,
    @Query('sucursal') sucursal?: string,
    @Query('pais') pais?: string,
    @Query('profesion') profesion?: string,
    @Query('departamento') departamento?: string,
    @Query('distrito') distrito?: string,
    @Query('localidad') localidad?: string,
    @Query('estadoContrato') estadoContrato?: string,
    @Query('vendedor') vendedor?: string,
    @Query('condominio') condominio?: string,
    @Query('recuperado') recuperado?: string,
    @Query('refinanciacion') refinanciacion?: string,
    @Query('indCliente') indCliente?: string,
    @Query('indProveedor') indProveedor?: string,
    @Query('indEmpleado') indEmpleado?: string,
    @Query('informconf') informconf?: string,
    @Query('idLote') idLote?: string,
    @Query('idFraccion') idFraccion?: string,
    @Query('mesesAtrasoDesde') mesesAtrasoDesde?: string,
    @Query('mesesAtrasoHasta') mesesAtrasoHasta?: string,
    @Query('fechaIngresoDesde') fechaIngresoDesde?: string,
    @Query('fechaIngresoHasta') fechaIngresoHasta?: string,
    @Query('fechaNacimientoDesde') fechaNacimientoDesde?: string,
    @Query('fechaNacimientoHasta') fechaNacimientoHasta?: string,
    @Query('fechaPrimeraVentaDesde') fechaPrimeraVentaDesde?: string,
    @Query('fechaPrimeraVentaHasta') fechaPrimeraVentaHasta?: string,
    @Query('fechaBajaDesde') fechaBajaDesde?: string,
    @Query('fechaBajaHasta') fechaBajaHasta?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    return this.service.findAll({
      limite: parseInt(limit || limite) || 100,
      offset: parseInt(offset) || 0,
      incluirTotal: this.parseBoolean(incluirTotal),
      idPersona: this.parseOptionalNumber(idPersona),
      numeroContrato,
      documento,
      ruc,
      nombreCompleto,
      primerNombre,
      primerApellido,
      estado,
      estadoCivil,
      nacionalidad,
      sexo,
      tipoDocumento,
      barrio,
      sucursal,
      pais,
      profesion,
      departamento,
      distrito,
      localidad,
      estadoContrato,
      vendedor,
      condominio,
      recuperado,
      refinanciacion,
      indCliente,
      indProveedor,
      indEmpleado,
      informconf,
      idLote: this.parseOptionalNumber(idLote),
      idFraccion: this.parseOptionalNumber(idFraccion),
      mesesAtrasoDesde: this.parseOptionalNumber(mesesAtrasoDesde),
      mesesAtrasoHasta: this.parseOptionalNumber(mesesAtrasoHasta),
      fechaIngresoDesde,
      fechaIngresoHasta,
      fechaNacimientoDesde,
      fechaNacimientoHasta,
      fechaPrimeraVentaDesde,
      fechaPrimeraVentaHasta,
      fechaBajaDesde,
      fechaBajaHasta,
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

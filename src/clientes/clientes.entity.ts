import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({ schema: 'ADCC', name: 'CBI_CLIENTES_V' })
export class ClientesEntity {
  @ViewColumn({ name: 'ID_PERSONA' })
  idPersona: number;

  @ViewColumn({ name: 'DIRECCION_EMAIL' })
  direccionEmail: string;

  @ViewColumn({ name: 'DIRECCION_PARTICULAR' })
  direccionParticular: string;

  @ViewColumn({ name: 'DOCUMENTO' })
  documento: string;

  @ViewColumn({ name: 'ESTADO' })
  estado: string;

  @ViewColumn({ name: 'ESTADO_CIVIL' })
  estadoCivil: string;

  @ViewColumn({ name: 'FECHA_BAJA' })
  fechaBaja: Date;

  @ViewColumn({ name: 'FECHA_INGRESO' })
  fechaIngreso: Date;

  @ViewColumn({ name: 'FECHA_NACIMIENTO' })
  fechaNacimiento: Date;

  @ViewColumn({ name: 'FECHA_PRIMERA_VENTA' })
  fechaPrimeraVenta: Date;

  @ViewColumn({ name: 'NACIONALIDAD' })
  nacionalidad: string;

  @ViewColumn({ name: 'NOMBRE_COMPLETO' })
  nombreCompleto: string;

  @ViewColumn({ name: 'OBSERVACION' })
  observacion: string;

  @ViewColumn({ name: 'PRIMER_APELLIDO' })
  primerApellido: string;

  @ViewColumn({ name: 'PRIMER_NOMBRE' })
  primerNombre: string;

  @ViewColumn({ name: 'RUC' })
  ruc: string;

  @ViewColumn({ name: 'SEGUNDO_APELLIDO' })
  segundoApellido: string;

  @ViewColumn({ name: 'SEGUNDO_NOMBRE' })
  segundoNombre: string;

  @ViewColumn({ name: 'SEXO' })
  sexo: string;

  @ViewColumn({ name: 'TELEFONO_OFICINA' })
  telefonoOficina: string;

  @ViewColumn({ name: 'TELEFONO_PARTICULAR' })
  telefonoParticular: string;

  @ViewColumn({ name: 'TIPO_DOCUMENTO' })
  tipoDocumento: string;

  @ViewColumn({ name: 'REFERENCIA_DIRECCION' })
  referenciaDireccion: string;

  @ViewColumn({ name: 'BARRIO' })
  barrio: string;

  @ViewColumn({ name: 'INFORMCONF' })
  informconf: string;

  @ViewColumn({ name: 'IND_CLIENTE' })
  indCliente: string;

  @ViewColumn({ name: 'IND_PROVEEDOR' })
  indProveedor: string;

  @ViewColumn({ name: 'IND_EMPLEDO' })
  indEmpleado: string;

  @ViewColumn({ name: 'LUGAR_TRABAJO' })
  lugarTrabajo: string;

  @ViewColumn({ name: 'SITUACIÓN' })
  situacion: string;

  @ViewColumn({ name: 'DIRECCION' })
  direccion: string;

  @ViewColumn({ name: 'SUCURSAL' })
  sucursal: string;

  @ViewColumn({ name: 'PAIS' })
  pais: string;

  @ViewColumn({ name: 'PROFESION' })
  profesion: string;

  @ViewColumn({ name: 'DEPARTAMENTO' })
  departamento: string;

  @ViewColumn({ name: 'DISTRITO' })
  distrito: string;

  @ViewColumn({ name: 'LOCALIDAD' })
  localidad: string;

  @ViewColumn({ name: 'NUMERO_CONTRATO' })
  numeroContrato: string;

  @ViewColumn({ name: 'ESTADO_CONTRATO' })
  estadoContrato: string;

  @ViewColumn({ name: 'VENDEDOR' })
  vendedor: string;

  @ViewColumn({ name: 'CONDOMINIO' })
  condominio: string;

  @ViewColumn({ name: 'PLAN_PAGO_VENDEDOR' })
  planPagoVendedor: string;

  @ViewColumn({ name: 'ID_LOTE' })
  idLote: number;

  @ViewColumn({ name: 'ID_FRACCION' })
  idFraccion: number;

  @ViewColumn({ name: 'NOMBRE_FRACCION' })
  nombreFraccion: string;

  @ViewColumn({ name: 'RECUPERADO' })
  recuperado: string;

  @ViewColumn({ name: 'REFINANCIACION' })
  refinanciacion: string;

  @ViewColumn({ name: 'MESES_ATRASO' })
  mesesAtraso: number;

  @ViewColumn({ name: 'MONTO_CUOTA' })
  montoCuota: number;
}

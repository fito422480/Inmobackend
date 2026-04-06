import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({ schema: 'ADCC', name: 'CBI_LOTES_V' })
export class LotesEntity {
  @ViewColumn({ name: 'ID_LOTE' })
  idLote: number;

  @ViewColumn({ name: 'ID_FRACCION' })
  idFraccion: number;

  @ViewColumn({ name: 'ID_MANZANA' })
  idManzana: number;

  @ViewColumn({ name: 'ID_CLIENTE' })
  idCliente: number;

  @ViewColumn({ name: 'COSTO_LOTE' })
  costoLote: number;

  @ViewColumn({ name: 'CTA_CTE_CTRAL' })
  ctaCteCtral: string;

  @ViewColumn({ name: 'DIMENSION' })
  dimension: number;

  @ViewColumn({ name: 'DIMENSION_ESTE' })
  dimensionEste: number;

  @ViewColumn({ name: 'DIMENSION_NORTE' })
  dimensionNorte: number;

  @ViewColumn({ name: 'DIMENSION_OESTE' })
  dimensionOeste: number;

  @ViewColumn({ name: 'DIMENSION_SUR' })
  dimensionSur: number;

  @ViewColumn({ name: 'ESTADO' })
  estado: string;

  @ViewColumn({ name: 'LINDERO_ESTE' })
  linderoEste: string;

  @ViewColumn({ name: 'LINDERO_NORTE' })
  linderoNorte: string;

  @ViewColumn({ name: 'LINDERO_OESTE' })
  linderoOeste: string;

  @ViewColumn({ name: 'LINDERO_SUR' })
  linderoSur: string;

  @ViewColumn({ name: 'MONTO_CUOTA' })
  montoCuota: number;

  @ViewColumn({ name: 'NRO_FINCA' })
  nroFinca: string;

  @ViewColumn({ name: 'NUMERO_CONTRATO' })
  numeroContrato: string;

  @ViewColumn({ name: 'FECHA_CONTRATO' })
  fechaContrato: Date;

  @ViewColumn({ name: 'NUMERO_TRATO' })
  numeroTrato: string;

  @ViewColumn({ name: 'VENDEDOR' })
  vendedor: string;

  @ViewColumn({ name: 'PLAZO' })
  plazo: number;

  @ViewColumn({ name: 'SUCURSAL' })
  sucursal: string;

  @ViewColumn({ name: 'OBSERVACION' })
  observacion: string;

  @ViewColumn({ name: 'PRECIO_CONTADO' })
  precioContado: number;

  @ViewColumn({ name: 'PRECIO_FINANCIADO' })
  precioFinanciado: number;

  @ViewColumn({ name: 'PRECIO_VENTA_FINAL' })
  precioVentaFinal: number;

  @ViewColumn({ name: 'TOTAL_PAGADO' })
  totalPagado: number;

  @ViewColumn({ name: 'SALDO_DEUDOR' })
  saldoDeudor: number;

  @ViewColumn({ name: 'ULTIMA_CUOTA_PAGADA' })
  ultimaCuotaPagada: number;

  @ViewColumn({ name: 'FECHA_ULTIMO_PAGO' })
  fechaUltimoPago: Date;

  @ViewColumn({ name: 'PORCENTAJE_MORA' })
  porcentajeMora: number;

  @ViewColumn({ name: 'ID_MONEDA' })
  idMoneda: number;

  @ViewColumn({ name: 'RGP_FOLIO' })
  rgpFolio: string;

  @ViewColumn({ name: 'RGP_ANIO_INCRIPCION' })
  rgpAnioIncripcion: number;

  @ViewColumn({ name: 'FECHA_INCRIPCION_MUNIC' })
  fechaIncripcionMunic: Date;

  @ViewColumn({ name: 'FECHA_VENTA' })
  fechaVenta: Date;

  @ViewColumn({ name: 'NRO_RESOLUCION_MUNIC' })
  nroResolucionMunic: string;

  @ViewColumn({ name: 'ID_EMPRESA' })
  idEmpresa: number;

  @ViewColumn({ name: 'NUMERO_LOTE' })
  numeroLote: string;

  @ViewColumn({ name: 'CLIENTE' })
  cliente: string;

  @ViewColumn({ name: 'DOC_IDENT_CLIENTE' })
  docIdentCliente: string;

  @ViewColumn({ name: 'IND_CLIENTE' })
  indCliente: string;

  @ViewColumn({ name: 'IND_PROVEEDOR' })
  indProveedor: string;

  @ViewColumn({ name: 'IND_EMPLEADO' })
  indEmpleado: string;

  @ViewColumn({ name: 'PROFESION' })
  profesion: string;

  @ViewColumn({ name: 'LUGAR_TRABAJO' })
  lugarTrabajo: string;

  @ViewColumn({ name: 'SITUACION' })
  situacion: string;

  @ViewColumn({ name: 'NACIONALIDAD' })
  nacionalidad: string;

  @ViewColumn({ name: 'PAIS' })
  pais: string;

  @ViewColumn({ name: 'CLIENTE_OBSERVACION' })
  clienteObservacion: string;

  @ViewColumn({ name: 'LOCALIDAD' })
  localidad: string;
}

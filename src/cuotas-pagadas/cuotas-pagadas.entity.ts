import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({ schema: 'ADCC', name: 'CBI_CUOTAS_PAGADAS_V' })
export class CuotasPagadasEntity {

  @ViewColumn({ name: 'ID_FRACCION' })
  idFraccion: number;

  @ViewColumn({ name: 'NOMBRE_FRACCION' })
  nombreFraccion: string;

  @ViewColumn({ name: 'ID_MANZANA' })
  idManzana: number;

  @ViewColumn({ name: 'ID_LOTE' })
  idLote: number;

  @ViewColumn({ name: 'NUMERO_CONTRATO' })
  numeroContrato: string;

  @ViewColumn({ name: 'SUCURSAL' })
  sucursal: string;

  @ViewColumn({ name: 'NOMBRE_PARA_DOCUMENTO' })
  nombreParaDocumento: string;

  @ViewColumn({ name: 'ID_CLIENTE' })
  idCliente: number;

  @ViewColumn({ name: 'DOCUMENTO' })
  documento: string;

  @ViewColumn({ name: 'NUMERO_CUOTA' })
  numeroCuota: number;

  @ViewColumn({ name: 'TOTAL_CUOTAS' })
  totalCuotas: number;

  @ViewColumn({ name: 'ESTADO_ACTUAL_CONTRATO' })
  estadoActualContrato: string;

  @ViewColumn({ name: 'MONTO_CUOTA' })
  montoCuota: number;

  @ViewColumn({ name: 'MORA_CUOTA' })
  moraCuota: number;

  @ViewColumn({ name: 'FECHA_VENCIMIENTO' })
  fechaVencimiento: Date;

  @ViewColumn({ name: 'MESES_MORA' })
  mesesMora: number;

  @ViewColumn({ name: 'INTERES_COBRADO' })
  interesCobrado: number;

  @ViewColumn({ name: 'DESCUENTO_INTERES' })
  descuentoInteres: number;

  @ViewColumn({ name: 'CUOTA_COBRADA' })
  cuotaCobrada: number;

  @ViewColumn({ name: 'NOTA_CRED' })
  notaCred: string;

  @ViewColumn({ name: 'TELEFONO_CELULAR' })
  telefonoCelular: string;

  @ViewColumn({ name: 'FECHA_PAGO' })
  fechaPago: Date;

  @ViewColumn({ name: 'MONEDA' })
  moneda: string;

  @ViewColumn({ name: 'NRO_FACTURA' })
  nroFactura: string;

  @ViewColumn({ name: 'FORMA_PAGO' })
  formaPago: string;

  @ViewColumn({ name: 'FEC_CONTRATO' })
  fecContrato: Date;

  @ViewColumn({ name: 'FEC_TRATO' })
  fecTrato: Date;

  @ViewColumn({ name: 'VENDEDOR' })
  vendedor: string;

  @ViewColumn({ name: 'PLAN_PAGO_VENDEDOR' })
  planPagoVendedor: string;

  @ViewColumn({ name: 'REFINANCIACION' })
  refinanciacion: string;

  @ViewColumn({ name: 'CANCELACION_ANTICIPADA' })
  cancelacionAnticipada: string;
}

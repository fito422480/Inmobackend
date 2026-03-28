import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({ schema: 'ADCC', name: 'CBI_CUOTAS_V' })
export class CuotasVencidasEntity {
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

  @ViewColumn({ name: 'FEC_CONTRATO' })
  fecContrato: Date;

  @ViewColumn({ name: 'FEC_TRATO' })
  fecTrato: Date;

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

  @ViewColumn({ name: 'ESTADO' })
  estado: string;

  @ViewColumn({ name: 'MONTO_CUOTA' })
  montoCuota: number;

  @ViewColumn({ name: 'PLAZO' })
  plazo: number;

  @ViewColumn({ name: 'MORA_CUOTA' })
  moraCuota: number;

  @ViewColumn({ name: 'FECHA_VENCIMIENTO' })
  fechaVencimiento: Date;

  @ViewColumn({ name: 'MESES_MORA' })
  mesesMora: number;

  @ViewColumn({ name: 'ULTIMO_PAGO' })
  ultimoPago: Date;

  @ViewColumn({ name: 'SALDO_VENCIDO' })
  saldoVencido: number;

  @ViewColumn({ name: 'TELEFONO_CELULAR' })
  telefonoCelular: string;

  @ViewColumn({ name: 'ESTADO_CONTRATO' })
  estadoContrato: string;

  @ViewColumn({ name: 'VENDEDOR' })
  vendedor: string;

  @ViewColumn({ name: 'ESTADO_CUOTA' })
  estadoCuota: string;
}

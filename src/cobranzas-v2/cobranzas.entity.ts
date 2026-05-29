import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({ schema: 'ADCC', name: 'CBI_INMC093_FOTO_V' })
export class CobranzasV2Entity {
  @ViewColumn({ name: 'CONTRATO' })
  contrato: string;

  @ViewColumn({ name: 'FEC_CONTRATO' })
  fecContrato: Date;

  @ViewColumn({ name: 'TITULAR' })
  titular: string;

  @ViewColumn({ name: 'CI_RUC' })
  ciRuc: string;

  @ViewColumn({ name: 'TELEFONO' })
  telefono: string;

  @ViewColumn({ name: 'SUCURSAL' })
  sucursal: string;

  @ViewColumn({ name: 'FRACCION' })
  fraccion: string;

  @ViewColumn({ name: 'MANZANA' })
  manzana: string;

  @ViewColumn({ name: 'LOTE' })
  lote: string;

  @ViewColumn({ name: 'PADRON' })
  padron: string;

  @ViewColumn({ name: 'VENCIMIENTO' })
  vencimiento: Date;

  @ViewColumn({ name: 'CUOTA' })
  cuota: number;

  @ViewColumn({ name: 'IMPORTE_CUOTA' })
  importeCuota: number;

  @ViewColumn({ name: 'PLAZO' })
  plazo: number;

  @ViewColumn({ name: 'ULTIMO_PAGO' })
  ultimoPago: Date;

  @ViewColumn({ name: 'FECHA_SEÑA' })
  fechaSenia: Date;

  @ViewColumn({ name: 'MESES_ATRASO' })
  mesesAtraso: number;

  @ViewColumn({ name: 'SALDO_VENCIDO' })
  saldoVencido: number;

  @ViewColumn({ name: 'INTERES' })
  interes: number;

  @ViewColumn({ name: 'ESTADO' })
  estado: string;

  @ViewColumn({ name: 'COBRADOR' })
  cobrador: string;

  @ViewColumn({ name: 'EMPRESA' })
  empresa: string;
}

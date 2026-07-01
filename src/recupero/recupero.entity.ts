import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({ schema: 'ADCC', name: 'CBI_INMC093_V' })
export class RecuperoEntity {
  @ViewColumn({ name: 'CONTRATO' })
  contrato: string;

  @ViewColumn({ name: 'CI_RUC' })
  ciRuc: string;

  @ViewColumn({ name: 'SUCURSAL' })
  sucursal: string;

  @ViewColumn({ name: 'FRACCION' })
  fraccion: string;

  @ViewColumn({ name: 'MANZANA' })
  manzana: string;

  @ViewColumn({ name: 'LOTE' })
  lote: string;

  @ViewColumn({ name: 'VENCIMIENTO' })
  vencimiento: Date;

  @ViewColumn({ name: 'IMPORTE_CUOTA' })
  importeCuota: number;

  @ViewColumn({ name: 'PLAZO' })
  plazo: number;

  @ViewColumn({ name: 'MESES_ATRASO' })
  mesesAtraso: number;
}

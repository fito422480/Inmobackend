import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({ schema: 'ADCC', name: 'CBI_FINC001_V' })
export class IngresosEntity {
  @ViewColumn({ name: 'CLAVE' })
  clave: number;

  @ViewColumn({ name: 'TIPO_MOV' })
  tipoMov: string;

  @ViewColumn({ name: 'NUMERO_DOCUMENTO' })
  numeroDocumento: string;

  @ViewColumn({ name: 'CTA_BANCARIA' })
  ctaBancaria: string;

  @ViewColumn({ name: 'MONEDA' })
  moneda: string;

  @ViewColumn({ name: 'FECHA_DOCUMENTO' })
  fechaDocumento: Date;

  @ViewColumn({ name: 'TOTAL' })
  total: number;

  @ViewColumn({ name: 'OBSERVACION' })
  observacion: string;

  @ViewColumn({ name: 'ARTICULO' })
  articulo: string;
}

import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({ schema: 'ADCC', name: 'CBI_CUOTAS_PAGADAS_V' })
export class TotalPagadoMesEntity {
  @ViewColumn({ name: 'FECHA_PAGO' })
  fechaPago: Date;

  @ViewColumn({ name: 'NUMERO_CUOTA' })
  numeroCuota: number;

  @ViewColumn({ name: 'CUOTA_COBRADA' })
  cuotaCobrada: number;

  @ViewColumn({ name: 'MONTO_CUOTA' })
  montoCuota: number;

  @ViewColumn({ name: 'NOTA_CRED' })
  notaCred: number;

  @ViewColumn({ name: 'INTERES_COBRADO' })
  interesCobrado: number;
}

import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({ schema: 'ADCC', name: 'CBI_FRACCIONES_V' })
export class FraccionesEntity {
  @ViewColumn({ name: 'CIUDAD' })
  ciudad: string;

  @ViewColumn({ name: 'NOMBRE_FRACCION' })
  nombreFraccion: string;

  @ViewColumn({ name: 'DISPONIBLES' })
  disponibles: number;

  @ViewColumn({ name: 'ESTADO' })
  estado: string;
}

export type IngresoCategoria =
  | 'RECIBO_CUOTAS'
  | 'INTERESES'
  | 'GESTION_COBRANZAS'
  | 'CESION_DERECHOS'
  | 'FACTURACION_PROPIETARIOS'
  | 'OTROS_INGRESOS'
  | 'NOTA_CREDITO';

export class IngresosRangoQueryDto {
  fechaDesde: string;
  fechaHasta: string;
}

export class IngresosDetalleQueryDto extends IngresosRangoQueryDto {
  limite?: number;
  offset?: number;
  categoria?: string;
}

export class IngresoDiaRowDto {
  fecha: string;
  categoria: IngresoCategoria;
  /** Solo en FACTURACION_PROPIETARIOS: ADMINISTRACION, VENTAS, INTERESES, RECUPERO_GASTOS, GASTOS_PROYECTO (unidos con '+'). */
  concepto: string | null;
  cuenta: string | null;
  moneda: string;
  documentos: number;
  total: number;
}

export class IngresoResumenFechaDto {
  fecha: string;
  moneda: string;
  cuotas: number;
  intereses: number;
  gestionCobranzas: number;
  cesionDerechos: number;
  otrosIngresos: number;
  /** cuotas + intereses + gestion + cesion + otros. No resta notas de credito ni incluye facturacion a propietarios. */
  ingresoOperativo: number;
  facturacionPropietarios: number;
  notasCredito: number;
}

export class IngresosDiaResponseDto {
  fechaDesde: string;
  fechaHasta: string;
  data: IngresoDiaRowDto[];
  resumenPorFecha: IngresoResumenFechaDto[];
}

export class IngresoDetalleItemDto {
  fecha: string;
  categoria: IngresoCategoria;
  concepto: string | null;
  numeroDocumento: string;
  cuenta: string | null;
  moneda: string;
  articulo: string | null;
  lineas: number;
  total: number;
  observacion: string | null;
}

export class IngresosDetalleResponseDto {
  fechaDesde: string;
  fechaHasta: string;
  data: IngresoDetalleItemDto[];
  limite: number;
  offset: number;
  pagina: number;
  tieneMas: boolean;
}

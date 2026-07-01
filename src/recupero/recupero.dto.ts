export class RecuperoQueryDto {
  limite?: number;
  offset?: number;
  incluirTotal?: boolean;
  contrato?: string;
  vendedor?: string;
  nombreCompleto?: string;
  ciRuc?: string;
  telefonoParticular?: string;
  sucursal?: string;
  nombreFraccion?: string;
  manzana?: string;
  lote?: string;
  vencimientoDesde?: string;
  vencimientoHasta?: string;
  importeCuota?: number;
  importeCuotaDesde?: number;
  importeCuotaHasta?: number;
  plazo?: number;
  plazoDesde?: number;
  plazoHasta?: number;
  mesesAtraso?: number;
  mesesAtrasoDesde?: number;
  mesesAtrasoHasta?: number;
}

export class RecuperoItemDto {
  contrato: string | null;
  vendedor: string | null;
  nombreCompleto: string | null;
  ciRuc: string | null;
  telefonoParticular: string | null;
  sucursal: string | null;
  nombreFraccion: string | null;
  manzana: string | null;
  lote: string | null;
  vencimiento: string | null;
  importeCuota: number | null;
  plazo: number | null;
  mesesAtraso: number | null;
}

export class RecuperoResponseDto<T> {
  data: T[];
  total: number | null;
  limite: number;
  offset: number;
  pagina: number;
  totalPaginas: number | null;
  incluirTotal: boolean;
  tieneMas?: boolean;
}

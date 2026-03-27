export class PaginacionDto {
  limite: number;
  offset: number;
  incluirTotal?: boolean;
  // Filtros opcionales
  numeroContrato?: string;
  documento?: string;
  idCliente?: number;
  sucursal?: string;
  estadoActualContrato?: string;
  moneda?: string;
  fechaDesde?: string;  // YYYY-MM-DD
  fechaHasta?: string;  // YYYY-MM-DD
}

export class PaginacionResponseDto<T> {
  data: T[];
  total: number | null;
  limite: number;
  offset: number;
  pagina: number;
  totalPaginas: number | null;
  incluirTotal: boolean;
  tieneMas?: boolean;
}

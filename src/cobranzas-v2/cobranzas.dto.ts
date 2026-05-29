export class PaginacionDto {
  limite?: number;
  offset?: number;
  cursor?: string;
  incluirTotal?: boolean;
  contrato?: string;
  cobrador?: string;
  empresa?: string;
  estado?: string;
  mesesAtraso?: number;
  mesesAtrasoDesde?: number;
  mesesAtrasoHasta?: number;
}

export class PaginacionResponseDto<T> {
  data: T[];
  total: number | null;
  limite: number;
  offset: number | null;
  pagina: number | null;
  totalPaginas: number | null;
  incluirTotal: boolean;
  modoPaginacion: 'cursor' | 'offset';
  cursorActual?: string | null;
  nextCursor?: string | null;
  tieneMas?: boolean;
}

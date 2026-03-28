export class PaginacionDto {
  limite?: number;
  offset?: number;
  cursor?: string;
  incluirTotal?: boolean;
  numeroContrato?: string;
  documento?: string;
  idCliente?: number;
  sucursal?: string;
  estado?: string;
  estadoContrato?: string;
  estadoCuota?: string;
  vendedor?: string;
  mesesMoraDesde?: number;
  mesesMoraHasta?: number;
  mesesMoraHastaExclusivo?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  fechaVencimientoDesde?: string;
  fechaVencimientoHasta?: string;
  ultimoPagoDesde?: string;
  ultimoPagoHasta?: string;
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

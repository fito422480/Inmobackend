export class PaginacionDto {
  limite?: number;
  offset?: number;
  incluirTotal?: boolean;
  numeroContrato?: string;
  documento?: string;
  idCliente?: number;
  sucursal?: string;
  estado?: string;
  estadoContrato?: string;
  estadoCuota?: string;
  vendedor?: string;
  fechaVencimientoDesde?: string;
  fechaVencimientoHasta?: string;
  ultimoPagoDesde?: string;
  ultimoPagoHasta?: string;
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

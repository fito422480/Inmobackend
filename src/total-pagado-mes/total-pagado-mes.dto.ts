export class TotalPagadoMesQueryDto {
  limite?: number;
  offset?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  numeroCuotaMinima?: number;
  incluirTotal?: boolean;
}

export class TotalPagadoMesItemDto {
  anio: number;
  mes: number;
  totalPagado: number;
  totalPagadoReal: number;
  notaCredito: number;
  totalInteres: number;
}

export class TotalPagadoMesResponseDto<T> {
  data: T[];
  total: number | null;
  limite: number;
  offset: number;
  pagina: number;
  totalPaginas: number | null;
  incluirTotal: boolean;
  tieneMas?: boolean;
}

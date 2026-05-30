export class TotalPagadoQueryDto {
  limite?: number;
  offset?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  numeroCuotaMinima?: number;
  incluirTotal?: boolean;
}

export class TotalPagadoItemDto {
  fecha: string;
  mes: number;
  dia: number;
  totalPagado: number;
  totalPagadoReal: number;
  notaCredito: number;
  totalInteres: number;
}

export class TotalPagadoResponseDto<T> {
  data: T[];
  total: number | null;
  limite: number;
  offset: number;
  pagina: number;
  totalPaginas: number | null;
  incluirTotal: boolean;
  tieneMas?: boolean;
}

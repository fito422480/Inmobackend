export class PagosPorFranjaQueryDto {
  limite?: number;
  offset?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  numeroCuotaMinima?: number;
  mesesMora?: number;
  mesesMoraDesde?: number;
  mesesMoraHasta?: number;
  incluirTotal?: boolean;
}

export class PagoPorFranjaItemDto {
  mesesMora: number | null;
  fecha: string | null;
  mes: number | null;
  dia: number | null;
  totalPagado: number;
  totalPagadoReal: number;
  notaCredito: number;
  totalInteres: number;
}

export class PagosPorFranjaResponseDto<T> {
  data: T[];
  total: number | null;
  limite: number;
  offset: number;
  pagina: number;
  totalPaginas: number | null;
  incluirTotal: boolean;
  tieneMas?: boolean;
}

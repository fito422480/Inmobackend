export class PaginacionDto {
  limite?: number;
  offset?: number;
  incluirTotal?: boolean;
  numeroContrato?: string;
  numeroCuota?: number;
  numeroCuotaDesde?: number;
  numeroCuotaHasta?: number;
  fechaVencimientoDesde?: string;
  fechaVencimientoHasta?: string;
}

export class DetalleCuotaDto {
  numeroContrato: string;
  fechaVencimiento: Date | string | null;
  fechaPago: Date | string | null;
  numeroCuota: number;
  montoCuota: number;
  cuotaCobrada: number | null;
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

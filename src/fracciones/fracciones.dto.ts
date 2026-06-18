export class FraccionesQueryDto {
  limite?: number;
  offset?: number;
  incluirTotal?: boolean;
}

export class FraccionesItemDto {
  ciudad: string;
  fraccion: string;
  disponibles: number;
}

export class FraccionesResponseDto<T> {
  data: T[];
  total: number | null;
  limite: number;
  offset: number;
  pagina: number;
  totalPaginas: number | null;
  incluirTotal: boolean;
  tieneMas?: boolean;
}

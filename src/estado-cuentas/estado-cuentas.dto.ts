export class EstadoCuentasQueryDto {
  limite?: number;
  offset?: number;
  cursor?: string;
  incluirTotal?: boolean;
  documento?: string;
  contrato?: string;
}

export class EstadoCuentaDto {
  nombreCompleto: string;
  documento: string;
  telefonoParticular: string | null;
  telefonoOficina: string | null;
  contrato: string;
  estado: string;
  mesesAtraso: number;
  numeroCuota: number;
}

export class EstadoCuentasResponseDto<T> {
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

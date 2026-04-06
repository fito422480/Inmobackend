export class PaginacionDto {
  limite?: number;
  offset?: number;
  incluirTotal?: boolean;

  idPersona?: number;
  numeroContrato?: string;
  documento?: string;
  ruc?: string;
  nombreCompleto?: string;
  primerNombre?: string;
  primerApellido?: string;
  estado?: string;
  estadoCivil?: string;
  nacionalidad?: string;
  sexo?: string;
  tipoDocumento?: string;
  barrio?: string;
  sucursal?: string;
  pais?: string;
  profesion?: string;
  departamento?: string;
  distrito?: string;
  localidad?: string;
  estadoContrato?: string;
  vendedor?: string;
  condominio?: string;
  recuperado?: string;
  refinanciacion?: string;
  indCliente?: string;
  indProveedor?: string;
  indEmpleado?: string;
  informconf?: string;
  idLote?: number;
  idFraccion?: number;
  mesesAtrasoDesde?: number;
  mesesAtrasoHasta?: number;
  fechaIngresoDesde?: string;
  fechaIngresoHasta?: string;
  fechaNacimientoDesde?: string;
  fechaNacimientoHasta?: string;
  fechaPrimeraVentaDesde?: string;
  fechaPrimeraVentaHasta?: string;
  fechaBajaDesde?: string;
  fechaBajaHasta?: string;
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

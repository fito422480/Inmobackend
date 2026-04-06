export class PaginacionDto {
  limite?: number;
  offset?: number;
  incluirTotal?: boolean;

  idLote?: number;
  idFraccion?: number;
  idManzana?: number;
  idCliente?: number;
  idMoneda?: number;
  idEmpresa?: number;
  numeroContrato?: string;
  numeroTrato?: string;
  numeroLote?: string;
  cliente?: string;
  docIdentCliente?: string;
  estado?: string;
  sucursal?: string;
  vendedor?: string;
  ctaCteCtral?: string;
  nroFinca?: string;
  rgpFolio?: string;
  nroResolucionMunic?: string;
  observacion?: string;
  clienteObservacion?: string;
  nacionalidad?: string;
  pais?: string;
  profesion?: string;
  localidad?: string;
  indCliente?: string;
  indProveedor?: string;
  indEmpleado?: string;
  lugarTrabajo?: string;
  situacion?: string;
  plazoDesde?: number;
  plazoHasta?: number;
  costoLoteDesde?: number;
  costoLoteHasta?: number;
  montoCuotaDesde?: number;
  montoCuotaHasta?: number;
  totalPagadoDesde?: number;
  totalPagadoHasta?: number;
  saldoDeudorDesde?: number;
  saldoDeudorHasta?: number;
  porcentajeMoraDesde?: number;
  porcentajeMoraHasta?: number;
  fechaContratoDesde?: string;
  fechaContratoHasta?: string;
  fechaUltimoPagoDesde?: string;
  fechaUltimoPagoHasta?: string;
  fechaIncripcionMunicDesde?: string;
  fechaIncripcionMunicHasta?: string;
  fechaVentaDesde?: string;
  fechaVentaHasta?: string;
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

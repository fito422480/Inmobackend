import { Controller, Get, Query } from '@nestjs/common';
import { CuotasVencidasService } from './cuotas-vencidas.service';

@Controller('cuotas-vencidas')
export class CuotasVencidasController {
  constructor(private service: CuotasVencidasService) {}

  /**
   * GET /cuotas-vencidas
   *
   * Query params:
   *   limit|limite         número de registros por página (default: 100, max: 100000)
   *   cursor               cursor opaco para seguir a la siguiente página
   *   offset               fallback de compatibilidad para paginación tradicional
   *   numeroContrato       filtrar por contrato
   *   documento            filtrar por documento del cliente
   *   idCliente            filtrar por ID de cliente
   *   sucursal             filtrar por sucursal
   *   estado               filtrar por estado
   *   estadoContrato       filtrar por estado del contrato
   *   estadoCuota          filtrar por estado de la cuota
   *   vendedor             filtrar por vendedor
   *   mesesMoraDesde       MESES_MORA >= valor
   *   mesesMoraHasta       MESES_MORA <= valor
   *   mesesMoraHastaExclusivo MESES_MORA < valor (no combinar con mesesMoraHasta)
   *   fechaDesde           alias de fechaVencimientoDesde
   *   fechaHasta           alias de fechaVencimientoHasta
   *   fechaVencimientoDesde FECHA_VENCIMIENTO >= (YYYY-MM-DD)
   *   fechaVencimientoHasta FECHA_VENCIMIENTO <= (YYYY-MM-DD)
   *   ultimoPagoDesde      ULTIMO_PAGO >= (YYYY-MM-DD)
   *   ultimoPagoHasta      ULTIMO_PAGO <= (YYYY-MM-DD)
   *   incluirTotal         true|false (default: false para evitar COUNT(*) en vistas grandes)
   *
   * Ejemplos:
   *   GET /cuotas-vencidas?limit=100
   *   GET /cuotas-vencidas?limit=100&cursor=eyJmdiI6IjIwMjQtMDEtMDEgMDA6MDA6MDAiLCJuYyI6IjEyMyIsIm5xIjoxfQ
   *   GET /cuotas-vencidas?limit=100&incluirTotal=true
   *   GET /cuotas-vencidas?documento=1234567&limit=100
   *   GET /cuotas-vencidas?mesesMoraDesde=0&mesesMoraHastaExclusivo=31&limit=100
   *   GET /cuotas-vencidas?estadoCuota=VENCIDA&fechaVencimientoDesde=2024-01-01&limit=100
   */
  @Get()
  findAll(
    @Query('limit') limit: string,
    @Query('limite') limite: string,
    @Query('cursor') cursor?: string,
    @Query('offset') offset?: string,
    @Query('numeroContrato') numeroContrato?: string,
    @Query('documento') documento?: string,
    @Query('idCliente') idCliente?: string,
    @Query('sucursal') sucursal?: string,
    @Query('estado') estado?: string,
    @Query('estadoContrato') estadoContrato?: string,
    @Query('estadoCuota') estadoCuota?: string,
    @Query('vendedor') vendedor?: string,
    @Query('mesesMoraDesde') mesesMoraDesde?: string,
    @Query('mesesMoraHasta') mesesMoraHasta?: string,
    @Query('mesesMoraHastaExclusivo') mesesMoraHastaExclusivo?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('fechaVencimientoDesde') fechaVencimientoDesde?: string,
    @Query('fechaVencimientoHasta') fechaVencimientoHasta?: string,
    @Query('ultimoPagoDesde') ultimoPagoDesde?: string,
    @Query('ultimoPagoHasta') ultimoPagoHasta?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    return this.service.findAll({
      limite: parseInt(limit || limite) || 100,
      offset: offset !== undefined ? parseInt(offset) || 0 : undefined,
      cursor,
      incluirTotal: this.parseBoolean(incluirTotal),
      numeroContrato,
      documento,
      idCliente: idCliente ? parseInt(idCliente) : undefined,
      sucursal,
      estado,
      estadoContrato,
      estadoCuota,
      vendedor,
      mesesMoraDesde: this.parseOptionalNumber(mesesMoraDesde),
      mesesMoraHasta: this.parseOptionalNumber(mesesMoraHasta),
      mesesMoraHastaExclusivo: this.parseOptionalNumber(
        mesesMoraHastaExclusivo,
      ),
      fechaDesde,
      fechaHasta,
      fechaVencimientoDesde,
      fechaVencimientoHasta,
      ultimoPagoDesde,
      ultimoPagoHasta,
    });
  }

  private parseBoolean(value?: string): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }

    return !['0', 'false', 'no'].includes(value.toLowerCase());
  }

  private parseOptionalNumber(value?: string): number | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}


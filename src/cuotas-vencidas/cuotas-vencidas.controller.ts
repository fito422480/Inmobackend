import { Controller, Get, Query } from '@nestjs/common';
import { CuotasVencidasService } from './cuotas-vencidas.service';

@Controller('cuotas-vencidas')
export class CuotasVencidasController {
  constructor(private service: CuotasVencidasService) {}

  /**
   * GET /cuotas-vencidas
   *
   * Query params:
   *   limit|limite         número de registros por página (default: 100, max: 1000)
   *   offset               desde qué registro empezar (default: 0)
   *   numeroContrato       filtrar por contrato
   *   documento            filtrar por documento del cliente
   *   idCliente            filtrar por ID de cliente
   *   sucursal             filtrar por sucursal
   *   estado               filtrar por estado
   *   estadoContrato       filtrar por estado del contrato
   *   estadoCuota          filtrar por estado de la cuota
   *   vendedor             filtrar por vendedor
   *   fechaVencimientoDesde FECHA_VENCIMIENTO >= (YYYY-MM-DD)
   *   fechaVencimientoHasta FECHA_VENCIMIENTO <= (YYYY-MM-DD)
   *   ultimoPagoDesde      ULTIMO_PAGO >= (YYYY-MM-DD)
   *   ultimoPagoHasta      ULTIMO_PAGO <= (YYYY-MM-DD)
   *   incluirTotal         true|false (default: false para evitar COUNT(*) en vistas grandes)
   *
   * Ejemplos:
   *   GET /cuotas-vencidas?limit=100&offset=0
   *   GET /cuotas-vencidas?limit=100&offset=100
   *   GET /cuotas-vencidas?limit=100&offset=0&incluirTotal=true
   *   GET /cuotas-vencidas?documento=1234567&limit=100&offset=0
   *   GET /cuotas-vencidas?estadoCuota=VENCIDA&fechaVencimientoDesde=2024-01-01&limit=100&offset=0
   */
  @Get()
  findAll(
    @Query('limit') limit: string,
    @Query('limite') limite: string,
    @Query('offset') offset: string,
    @Query('numeroContrato') numeroContrato?: string,
    @Query('documento') documento?: string,
    @Query('idCliente') idCliente?: string,
    @Query('sucursal') sucursal?: string,
    @Query('estado') estado?: string,
    @Query('estadoContrato') estadoContrato?: string,
    @Query('estadoCuota') estadoCuota?: string,
    @Query('vendedor') vendedor?: string,
    @Query('fechaVencimientoDesde') fechaVencimientoDesde?: string,
    @Query('fechaVencimientoHasta') fechaVencimientoHasta?: string,
    @Query('ultimoPagoDesde') ultimoPagoDesde?: string,
    @Query('ultimoPagoHasta') ultimoPagoHasta?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    return this.service.findAll({
      limite: parseInt(limit || limite) || 100,
      offset: parseInt(offset) || 0,
      incluirTotal: this.parseBoolean(incluirTotal),
      numeroContrato,
      documento,
      idCliente: idCliente ? parseInt(idCliente) : undefined,
      sucursal,
      estado,
      estadoContrato,
      estadoCuota,
      vendedor,
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
}

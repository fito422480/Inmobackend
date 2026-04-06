import { Controller, Get, Query } from '@nestjs/common';
import { CuotasPagadasService } from './cuotas-pagadas.service';

@Controller('cuotas-pagadas')
export class CuotasPagadasController {
  constructor(private service: CuotasPagadasService) {}

  /**
   * GET /cuotas-pagadas
   *
   * Query params:
   *   limite              número de registros por página (default: 100, max: 1000)
   *   offset              desde qué registro empezar (default: 0)
   *   numeroContrato      filtrar por contrato
   *   documento           filtrar por documento del cliente
   *   idCliente           filtrar por ID de cliente
   *   sucursal            filtrar por sucursal
   *   estadoActualContrato filtrar por estado
   *   moneda              filtrar por moneda (PYG, USD, etc.)
   *   fechaDesde          filtrar FECHA_PAGO >= (YYYY-MM-DD)
   *   fechaHasta          filtrar FECHA_PAGO <= (YYYY-MM-DD)
   *   incluirTotal        true|false (default: false para evitar COUNT(*) en vistas grandes)
   *
   * Ejemplos:
   *   GET /cuotas-pagadas?limite=100&offset=0
   *   GET /cuotas-pagadas?limite=100&offset=0&incluirTotal=false
   *   GET /cuotas-pagadas?limite=50&offset=200&sucursal=CDE
   *   GET /cuotas-pagadas?documento=1234567&limite=100&offset=0
   *   GET /cuotas-pagadas?fechaDesde=2024-01-01&fechaHasta=2024-12-31&limite=100&offset=0
   */
  @Get()
  findAll(
    @Query('limite') limite: string,
    @Query('offset') offset: string,
    @Query('numeroContrato') numeroContrato?: string,
    @Query('documento') documento?: string,
    @Query('idCliente') idCliente?: string,
    @Query('sucursal') sucursal?: string,
    @Query('estadoActualContrato') estadoActualContrato?: string,
    @Query('moneda') moneda?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    return this.service.findAll({
      limite: parseInt(limite) || 100,
      offset: parseInt(offset) || 0,
      incluirTotal: this.parseBoolean(incluirTotal),
      numeroContrato,
      documento,
      idCliente: idCliente ? parseInt(idCliente) : undefined,
      sucursal,
      estadoActualContrato,
      moneda,
      fechaDesde,
      fechaHasta,
    });
  }

  private parseBoolean(value?: string): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }

    return !['0', 'false', 'no'].includes(value.toLowerCase());
  }
}

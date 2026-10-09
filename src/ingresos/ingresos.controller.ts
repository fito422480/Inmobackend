import { Controller, Get, Query } from '@nestjs/common';
import { IngresosService } from './ingresos.service';

@Controller()
export class IngresosController {
  constructor(private readonly service: IngresosService) {}

  /**
   * GET /ingresos-dia?fecha=2026-10-05
   * GET /ingresos-dia?fechaDesde=2026-10-01&fechaHasta=2026-10-07
   *
   * Ingresos por fecha, categoria, cuenta/caja y moneda (una vez por documento).
   */
  @Get('ingresos-dia')
  ingresosDia(
    @Query('fecha') fecha?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    return this.service.ingresosDia({
      fechaDesde: fechaDesde ?? fecha ?? '',
      fechaHasta: fechaHasta ?? fecha ?? fechaDesde ?? '',
    });
  }

  /** GET /notas-credito?fechaDesde=2026-10-01&fechaHasta=2026-10-07 */
  @Get('notas-credito')
  notasCredito(
    @Query('fecha') fecha?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('limit') limit?: string,
    @Query('limite') limite?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.detalle({
      fechaDesde: fechaDesde ?? fecha ?? '',
      fechaHasta: fechaHasta ?? fecha ?? fechaDesde ?? '',
      limite: this.parseOptionalNumber(limit ?? limite),
      offset: this.parseOptionalNumber(offset),
      categoria: 'NOTA_CREDITO',
    });
  }

  /**
   * GET /ingresos-otros?fecha=2026-10-05[&categoria=INTERESES]
   * Facturas contado que no son cobro de cuotas (intereses, gestion, cesion, etc.).
   */
  @Get('ingresos-otros')
  ingresosOtros(
    @Query('fecha') fecha?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('categoria') categoria?: string,
    @Query('limit') limit?: string,
    @Query('limite') limite?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.detalle({
      fechaDesde: fechaDesde ?? fecha ?? '',
      fechaHasta: fechaHasta ?? fecha ?? fechaDesde ?? '',
      limite: this.parseOptionalNumber(limit ?? limite),
      offset: this.parseOptionalNumber(offset),
      categoria,
    });
  }

  private parseOptionalNumber(value?: string): number | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}

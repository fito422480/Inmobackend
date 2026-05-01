import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { DetalleCuotasService } from './detalle-cuotas.service';

@Controller('detalle-cuotas')
export class DetalleCuotasController {
  constructor(private service: DetalleCuotasService) {}

  /**
   * GET /detalle-cuotas
   *
   * Query params:
   *   limit|limite              número de registros por página (default: 100, max: configurable por DETALLE_CUOTAS_MAX_LIMIT)
   *   offset                    desde qué registro empezar (default: 0)
   *   numeroContrato            filtrar por contrato
   *   numeroCuota               filtrar por número de cuota exacto
   *   numeroCuotaDesde          NUMERO_CUOTA >= valor
   *   numeroCuotaHasta          NUMERO_CUOTA <= valor
   *   fechaVencimientoDesde     FECHA_VENCIMIENTO >= (YYYY-MM-DD)
   *   fechaVencimientoHasta     FECHA_VENCIMIENTO <= (YYYY-MM-DD)
   *   incluirTotal              true|false (default: false para evitar COUNT(*) extra)
   *
   * Ejemplos:
   *   GET /detalle-cuotas?numeroContrato=12345
   *   GET /detalle-cuotas?numeroContrato=12345&limit=50&offset=0
   *   GET /detalle-cuotas?fechaVencimientoDesde=2024-01-01&fechaVencimientoHasta=2024-12-31
   */
  @Get()
  findAll(
    @Query('limit') limit: string,
    @Query('limite') limite: string,
    @Query('offset') offset: string,
    @Query('numeroContrato') numeroContrato?: string,
    @Query('numeroCuota') numeroCuota?: string,
    @Query('numeroCuotaDesde') numeroCuotaDesde?: string,
    @Query('numeroCuotaHasta') numeroCuotaHasta?: string,
    @Query('fechaVencimientoDesde') fechaVencimientoDesde?: string,
    @Query('fechaVencimientoHasta') fechaVencimientoHasta?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    return this.service.findAll({
      limite: parseInt(limit || limite) || 100,
      offset: parseInt(offset) || 0,
      incluirTotal: this.parseBoolean(incluirTotal),
      numeroContrato,
      numeroCuota: this.parseOptionalNumber(numeroCuota),
      numeroCuotaDesde: this.parseOptionalNumber(numeroCuotaDesde),
      numeroCuotaHasta: this.parseOptionalNumber(numeroCuotaHasta),
      fechaVencimientoDesde,
      fechaVencimientoHasta,
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
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(
        `El valor "${value}" no es un número válido`,
      );
    }

    return parsed;
  }
}

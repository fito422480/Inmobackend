import { Controller, Get, Query } from '@nestjs/common';
import { CobranzasService } from './cobranzas.service';

@Controller('cobranzas')
export class CobranzasController {
  constructor(private service: CobranzasService) {}

  /**
   * GET /cobranzas
   *
   * Query params:
   *   limit|limite         número de registros por página (default: 100, max: 100000)
   *   cursor               cursor opaco para seguir a la siguiente página
   *   offset               fallback de compatibilidad para paginación tradicional
   *   estado               filtrar por ESTADO
   *   mesesAtrasoDesde     MESES_ATRASO >= valor
   *   mesesAtrasoHasta     MESES_ATRASO <= valor
   *   incluirTotal         true|false (default: false para evitar COUNT(*) en vistas grandes)
   *
   * Ejemplos:
   *   GET /cobranzas?limit=100
   *   GET /cobranzas?estado=VENCIDO&limit=100
   *   GET /cobranzas?mesesAtrasoDesde=3&mesesAtrasoHasta=12&limit=100
   *   GET /cobranzas?incluirTotal=true&offset=0&limit=100
   */
  @Get()
  findAll(
    @Query('limit') limit: string,
    @Query('limite') limite: string,
    @Query('cursor') cursor?: string,
    @Query('offset') offset?: string,
    @Query('estado') estado?: string,
    @Query('mesesAtrasoDesde') mesesAtrasoDesde?: string,
    @Query('mesesAtrasoHasta') mesesAtrasoHasta?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    return this.service.findAll({
      limite: parseInt(limit || limite) || 100,
      offset: offset !== undefined ? parseInt(offset) || 0 : undefined,
      cursor,
      incluirTotal: this.parseBoolean(incluirTotal),
      estado,
      mesesAtrasoDesde: this.parseOptionalNumber(mesesAtrasoDesde),
      mesesAtrasoHasta: this.parseOptionalNumber(mesesAtrasoHasta),
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

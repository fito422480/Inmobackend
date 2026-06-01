import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PagosPorFranjaQueryDto } from './pagos-por-franja.dto';
import { PagosPorFranjaService } from './pagos-por-franja.service';

@Controller('pagos-por-franja')
export class PagosPorFranjaController {
  constructor(private readonly service: PagosPorFranjaService) {}

  /**
   * GET /pagos-por-franja
   *
   * Query params:
   *   limit|limite         numero de registros por pagina (default: 100, max: configurable por PAGOS_POR_FRANJA_MAX_LIMIT)
   *   offset               desde que grupo empezar (default: 0)
   *   fechaDesde           filtrar FECHA_PAGO >= (YYYY-MM-DD)
   *   fechaHasta           filtrar FECHA_PAGO <= (YYYY-MM-DD)
   *   numeroCuotaMinima    filtrar NUMERO_CUOTA > valor (default: 1)
   *   mesesMora            filtrar MESES_MORA exacto
   *   mesesMoraDesde/Hasta filtrar rango de MESES_MORA
   *   incluirTotal         true|false (default: false para evitar COUNT(*) extra)
   *
   * Ejemplos:
   *   GET /pagos-por-franja?fechaDesde=2026-06-01
   *   GET /pagos-por-franja?fechaDesde=2026-06-01&fechaHasta=2026-06-30&mesesMoraDesde=1&mesesMoraHasta=6
   */
  @Get()
  findAll(
    @Query('limit') limit?: string,
    @Query('limite') limite?: string,
    @Query('offset') offset?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('numeroCuotaMinima') numeroCuotaMinima?: string,
    @Query('mesesMora') mesesMora?: string,
    @Query('mesesMoraDesde') mesesMoraDesde?: string,
    @Query('mesesMoraHasta') mesesMoraHasta?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    const dto: PagosPorFranjaQueryDto = {
      limite: this.parseOptionalInteger(limit ?? limite) ?? 100,
      offset: this.parseOptionalInteger(offset) ?? 0,
      fechaDesde,
      fechaHasta,
      numeroCuotaMinima: this.parseOptionalInteger(numeroCuotaMinima) ?? 1,
      mesesMora: this.parseOptionalInteger(mesesMora),
      mesesMoraDesde: this.parseOptionalInteger(mesesMoraDesde),
      mesesMoraHasta: this.parseOptionalInteger(mesesMoraHasta),
      incluirTotal: this.parseBoolean(incluirTotal),
    };

    return this.service.findAll(dto);
  }

  private parseBoolean(value?: string): boolean | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    return !['0', 'false', 'no'].includes(value.toLowerCase());
  }

  private parseOptionalInteger(value?: string): number | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      throw new BadRequestException(
        `El valor "${value}" no es un numero entero valido`,
      );
    }

    return parsed;
  }
}

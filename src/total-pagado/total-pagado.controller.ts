import { Controller, Get, Query } from '@nestjs/common';
import { TotalPagadoQueryDto } from './total-pagado.dto';
import { TotalPagadoService } from './total-pagado.service';

@Controller('total-pagado')
export class TotalPagadoController {
  constructor(private readonly service: TotalPagadoService) {}

  /**
   * GET /total-pagado
   *
   * Ejemplo equivalente a la query solicitada:
   * GET /total-pagado?fechaDesde=2026-05-01
   */
  @Get()
  findAll(
    @Query('limit') limit?: string,
    @Query('limite') limite?: string,
    @Query('offset') offset?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('numeroCuotaMinima') numeroCuotaMinima?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    const dto: TotalPagadoQueryDto = {
      limite: this.parseOptionalNumber(limit ?? limite) ?? 100,
      offset: this.parseOptionalNumber(offset) ?? 0,
      fechaDesde,
      fechaHasta,
      numeroCuotaMinima: this.parseOptionalNumber(numeroCuotaMinima) ?? 1,
      incluirTotal: this.parseBoolean(incluirTotal),
    };

    return this.service.findAll(dto);
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
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}

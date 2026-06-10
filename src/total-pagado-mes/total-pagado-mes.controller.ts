import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { TotalPagadoMesQueryDto } from './total-pagado-mes.dto';
import { TotalPagadoMesService } from './total-pagado-mes.service';

@Controller('total-pagado-mes')
export class TotalPagadoMesController {
  constructor(private readonly service: TotalPagadoMesService) {}

  /**
   * GET /total-pagado-mes
   *
   * Ejemplo equivalente a la agregacion mensual solicitada:
   * GET /total-pagado-mes?fechaDesde=2026-01-01&fechaHasta=2026-05-30
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
    const dto: TotalPagadoMesQueryDto = {
      limite: this.parseOptionalInteger(limit ?? limite) ?? 100,
      offset: this.parseOptionalInteger(offset) ?? 0,
      fechaDesde,
      fechaHasta,
      numeroCuotaMinima: this.parseOptionalInteger(numeroCuotaMinima) ?? 1,
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

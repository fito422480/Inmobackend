import { Controller, Get, Query } from '@nestjs/common';
import { FraccionesQueryDto } from './fracciones.dto';
import { FraccionesService } from './fracciones.service';

@Controller('fracciones')
export class FraccionesController {
  constructor(private readonly service: FraccionesService) {}

  /**
   * GET /fracciones
   *
   * Query params:
   *   limit|limite   numero de registros por pagina (default: 100, max: 1000)
   *   offset         desde que registro empezar (default: 0)
   *   incluirTotal   true|false (default: false)
   */
  @Get()
  findAll(
    @Query('limit') limit?: string,
    @Query('limite') limite?: string,
    @Query('offset') offset?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    const dto: FraccionesQueryDto = {
      limite: this.parseOptionalNumber(limit ?? limite) ?? 100,
      offset: this.parseOptionalNumber(offset) ?? 0,
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

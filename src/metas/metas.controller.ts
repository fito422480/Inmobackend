import { Controller, Get, Query } from '@nestjs/common';
import { MetasService } from './metas.service';

@Controller('metas')
export class MetasController {
  constructor(private readonly service: MetasService) {}

  /**
   * GET /metas
   *
   * Calcula el valor de la cartera de Mati, Jesus, Fernando y Judiciales.
   *
   * Query params:
   *   mes  periodo a calcular en formato YYYY-MM. Si no se envia, usa el
   *        mes actual de la zona horaria configurada.
   *
   * Ejemplos:
   *   GET /metas
   *   GET /metas?mes=2026-08
   */
  @Get()
  calcular(@Query('mes') mes?: string) {
    return this.service.calcular({ mes });
  }
}

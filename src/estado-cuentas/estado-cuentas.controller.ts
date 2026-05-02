import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { EstadoCuentasService } from './estado-cuentas.service';

@Controller('estado-cuentas')
export class EstadoCuentasController {
  constructor(private service: EstadoCuentasService) {}

  /**
   * GET /estado-cuentas
   *
   * Query params:
   *   limit|limite                  numero de registros por pagina (default: 100)
   *   cursor                        cursor opaco para seguir a la siguiente pagina
   *   offset                        fallback de compatibilidad para paginacion tradicional
   *   documento|numeroDocumento     filtrar por DOCUMENTO exacto
   *   contrato|numeroContrato       filtrar por CONTRATO exacto
   *   incluirTotal                  true|false (default: false para evitar COUNT(*) extra)
   *
   * Ejemplos:
   *   GET /estado-cuentas?documento=1234567
   *   GET /estado-cuentas?contrato=ABC123&limit=100
   *   GET /estado-cuentas?documento=1234567&contrato=ABC123
   */
  @Get()
  findAll(
    @Query('limit') limit?: string,
    @Query('limite') limite?: string,
    @Query('cursor') cursor?: string,
    @Query('offset') offset?: string,
    @Query('documento') documento?: string,
    @Query('numeroDocumento') numeroDocumento?: string,
    @Query('contrato') contrato?: string,
    @Query('numeroContrato') numeroContrato?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    return this.service.findAll({
      limite: this.parseOptionalInteger(limit || limite) ?? 100,
      offset: this.parseOptionalInteger(offset),
      cursor: this.normalizeText(cursor),
      incluirTotal: this.parseBoolean(incluirTotal),
      documento: this.normalizeText(documento || numeroDocumento),
      contrato: this.normalizeText(contrato || numeroContrato),
    });
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

  private normalizeText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }
}

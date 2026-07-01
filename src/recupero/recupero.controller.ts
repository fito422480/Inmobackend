import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { RecuperoQueryDto } from './recupero.dto';
import { RecuperoService } from './recupero.service';

@Controller('recupero')
export class RecuperoController {
  constructor(private readonly service: RecuperoService) {}

  /**
   * GET /recupero
   *
   * Query params:
   *   limit|limite                numero de registros por pagina (default: 100, max: configurable por RECUPERO_MAX_LIMIT)
   *   offset                      desde que registro empezar (default: 0)
   *   contrato|numeroContrato     filtrar por contrato
   *   ciRuc|documento             filtrar por CI_RUC
   *   vendedor                    filtrar por vendedor
   *   nombreCompleto              filtrar por nombre completo
   *   telefonoParticular          filtrar por telefono particular
   *   sucursal                    filtrar por sucursal
   *   nombreFraccion              filtrar por fraccion
   *   manzana                     filtrar por manzana
   *   lote                        filtrar por lote
   *   vencimientoDesde|fechaDesde filtrar VENCIMIENTO >= (YYYY-MM-DD)
   *   vencimientoHasta|fechaHasta filtrar VENCIMIENTO <= (YYYY-MM-DD)
   *   importeCuota                filtrar IMPORTE_CUOTA exacto
   *   importeCuotaDesde/Hasta     filtrar rango de IMPORTE_CUOTA
   *   plazo                       filtrar PLAZO exacto
   *   plazoDesde/Hasta            filtrar rango de PLAZO
   *   mesesAtraso                 filtrar MESES_ATRASO exacto
   *   mesesAtrasoDesde/Hasta      filtrar rango de MESES_ATRASO
   *   incluirTotal                true|false (default: false para evitar COUNT(*) extra)
   */
  @Get()
  findAll(
    @Query('limit') limit?: string,
    @Query('limite') limite?: string,
    @Query('offset') offset?: string,
    @Query('contrato') contrato?: string,
    @Query('numeroContrato') numeroContrato?: string,
    @Query('vendedor') vendedor?: string,
    @Query('nombreCompleto') nombreCompleto?: string,
    @Query('ciRuc') ciRuc?: string,
    @Query('documento') documento?: string,
    @Query('telefonoParticular') telefonoParticular?: string,
    @Query('sucursal') sucursal?: string,
    @Query('nombreFraccion') nombreFraccion?: string,
    @Query('manzana') manzana?: string,
    @Query('lote') lote?: string,
    @Query('vencimientoDesde') vencimientoDesde?: string,
    @Query('vencimientoHasta') vencimientoHasta?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('importeCuota') importeCuota?: string,
    @Query('importeCuotaDesde') importeCuotaDesde?: string,
    @Query('importeCuotaHasta') importeCuotaHasta?: string,
    @Query('plazo') plazo?: string,
    @Query('plazoDesde') plazoDesde?: string,
    @Query('plazoHasta') plazoHasta?: string,
    @Query('mesesAtraso') mesesAtraso?: string,
    @Query('mesesAtrasoDesde') mesesAtrasoDesde?: string,
    @Query('mesesAtrasoHasta') mesesAtrasoHasta?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    const dto: RecuperoQueryDto = {
      limite: this.parseOptionalInteger(limit ?? limite) ?? 100,
      offset: this.parseOptionalInteger(offset) ?? 0,
      incluirTotal: this.parseBoolean(incluirTotal),
      contrato: contrato ?? numeroContrato,
      vendedor,
      nombreCompleto,
      ciRuc: ciRuc ?? documento,
      telefonoParticular,
      sucursal,
      nombreFraccion,
      manzana,
      lote,
      vencimientoDesde: vencimientoDesde ?? fechaDesde,
      vencimientoHasta: vencimientoHasta ?? fechaHasta,
      importeCuota: this.parseOptionalNumber(importeCuota),
      importeCuotaDesde: this.parseOptionalNumber(importeCuotaDesde),
      importeCuotaHasta: this.parseOptionalNumber(importeCuotaHasta),
      plazo: this.parseOptionalInteger(plazo),
      plazoDesde: this.parseOptionalInteger(plazoDesde),
      plazoHasta: this.parseOptionalInteger(plazoHasta),
      mesesAtraso: this.parseOptionalInteger(mesesAtraso),
      mesesAtrasoDesde: this.parseOptionalInteger(mesesAtrasoDesde),
      mesesAtrasoHasta: this.parseOptionalInteger(mesesAtrasoHasta),
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

  private parseOptionalNumber(value?: string): number | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(
        `El valor "${value}" no es un numero valido`,
      );
    }

    return parsed;
  }
}

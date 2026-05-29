import { Controller, Get, Query } from '@nestjs/common';
import { CobranzasV2Service } from './cobranzas.service';

@Controller('cobranzas-v2')
export class CobranzasV2Controller {
  constructor(private service: CobranzasV2Service) {}

  /**
   * GET /cobranzas-v2
   *
   * Fuente:
   *   SELECT CONTRATO, FEC_CONTRATO, TITULAR, CI_RUC, TELEFONO, SUCURSAL,
   *          FRACCION, MANZANA, LOTE, PADRON, VENCIMIENTO, CUOTA,
   *          IMPORTE_CUOTA, PLAZO, ULTIMO_PAGO, FECHA_SEÑA, MESES_ATRASO,
   *          SALDO_VENCIDO, INTERES, ESTADO, COBRADOR, EMPRESA
   *   FROM ADCC.CBI_INMC093_FOTO_V
   *
   * Query params:
   *   limit|limite         número de registros por página (default: 100, max: 100000)
   *   cursor               cursor opaco para seguir a la siguiente página
   *   offset               fallback de compatibilidad para paginación tradicional
   *   contrato             filtrar por CONTRATO exacto
   *   cobrador             filtrar por COBRADOR exacto
   *   empresa              filtrar por EMPRESA exacta
   *   estado               filtrar por ESTADO exacto
   *   mesesAtraso          filtrar MESES_ATRASO exacto
   *   mesesAtrasoDesde     MESES_ATRASO >= valor
   *   mesesAtrasoHasta     MESES_ATRASO <= valor
   *   incluirTotal         true|false (default: false para evitar COUNT(*) en vistas grandes)
   */
  @Get()
  findAll(
    @Query('limit') limit: string,
    @Query('limite') limite: string,
    @Query('cursor') cursor?: string,
    @Query('offset') offset?: string,
    @Query('contrato') contrato?: string,
    @Query('cobrador') cobrador?: string,
    @Query('empresa') empresa?: string,
    @Query('estado') estado?: string,
    @Query('mesesAtraso') mesesAtraso?: string,
    @Query('mesesAtrasoDesde') mesesAtrasoDesde?: string,
    @Query('mesesAtrasoHasta') mesesAtrasoHasta?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    return this.service.findAll({
      limite: parseInt(limit || limite) || 100,
      offset: offset !== undefined ? parseInt(offset) || 0 : undefined,
      cursor: this.normalizeText(cursor),
      incluirTotal: this.parseBoolean(incluirTotal),
      contrato: this.normalizeText(contrato),
      cobrador: this.normalizeText(cobrador),
      empresa: this.normalizeText(empresa),
      estado: this.normalizeText(estado),
      mesesAtraso: this.parseOptionalNumber(mesesAtraso),
      mesesAtrasoDesde: this.parseOptionalNumber(mesesAtrasoDesde),
      mesesAtrasoHasta: this.parseOptionalNumber(mesesAtrasoHasta),
    });
  }

  private parseBoolean(value?: string): boolean | undefined {
    if (value === undefined || value === '') {
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

  private normalizeText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }
}

import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CuotasGeneralService } from './cuotas-general.service';

@Controller('cuotas-general')
export class CuotasGeneralController {
  constructor(private service: CuotasGeneralService) {}

  /**
   * GET /cuotas-general
   *
   * Query params:
   *   limit|limite              numero de registros por pagina (default: 100, max: configurable por CUOTAS_GENERAL_MAX_LIMIT)
   *   offset                    desde que registro empezar (default: 0)
   *   numeroContrato|contrato   filtrar por contrato exacto
   *   documento                 filtrar por documento exacto
   *   numeroCuota               filtrar por numero de cuota exacto
   *   numeroCuotaDesde/Hasta    rango de numero de cuota
   *   mesesMora                 filtrar por meses de mora exacto
   *   mesesMoraDesde/Hasta      rango de meses de mora
   *   fechaVencimientoDesde/Hasta rango de fecha de vencimiento (YYYY-MM-DD)
   *   fechaPagoDesde/Hasta      rango de fecha de pago (YYYY-MM-DD)
   *   incluirTotal              true|false (default: false para evitar COUNT(*) extra)
   *
   * Ejemplos:
   *   GET /cuotas-general?numeroContrato=A3779
   *   GET /cuotas-general?numeroContrato=A3779&limit=50&offset=0
   *   GET /cuotas-general?documento=1234567&estadoCuota=VENCIDA&incluirTotal=true
   */
  @Get()
  findAll(
    @Query('limit') limit?: string,
    @Query('limite') limite?: string,
    @Query('offset') offset?: string,
    @Query('idFraccion') idFraccion?: string,
    @Query('nombreFraccion') nombreFraccion?: string,
    @Query('idManzana') idManzana?: string,
    @Query('idLote') idLote?: string,
    @Query('numeroContrato') numeroContrato?: string,
    @Query('contrato') contrato?: string,
    @Query('sucursal') sucursal?: string,
    @Query('nombreParaDocumento') nombreParaDocumento?: string,
    @Query('idCliente') idCliente?: string,
    @Query('documento') documento?: string,
    @Query('numeroCuota') numeroCuota?: string,
    @Query('numeroCuotaDesde') numeroCuotaDesde?: string,
    @Query('numeroCuotaHasta') numeroCuotaHasta?: string,
    @Query('totalCuotas') totalCuotas?: string,
    @Query('estadoActualContrato') estadoActualContrato?: string,
    @Query('estadoContrato') estadoContrato?: string,
    @Query('montoCuotaDesde') montoCuotaDesde?: string,
    @Query('montoCuotaHasta') montoCuotaHasta?: string,
    @Query('moraCuotaDesde') moraCuotaDesde?: string,
    @Query('moraCuotaHasta') moraCuotaHasta?: string,
    @Query('fechaVencimientoDesde') fechaVencimientoDesde?: string,
    @Query('fechaVencimientoHasta') fechaVencimientoHasta?: string,
    @Query('mesesMora') mesesMora?: string,
    @Query('mesesMoraDesde') mesesMoraDesde?: string,
    @Query('mesesMoraHasta') mesesMoraHasta?: string,
    @Query('fechaPagoDesde') fechaPagoDesde?: string,
    @Query('fechaPagoHasta') fechaPagoHasta?: string,
    @Query('moneda') moneda?: string,
    @Query('nroFactura') nroFactura?: string,
    @Query('formaPago') formaPago?: string,
    @Query('fecContratoDesde') fecContratoDesde?: string,
    @Query('fecContratoHasta') fecContratoHasta?: string,
    @Query('fecTratoDesde') fecTratoDesde?: string,
    @Query('fecTratoHasta') fecTratoHasta?: string,
    @Query('vendedor') vendedor?: string,
    @Query('planPagoVendedor') planPagoVendedor?: string,
    @Query('refinanciacion') refinanciacion?: string,
    @Query('cancelacionAnticipada') cancelacionAnticipada?: string,
    @Query('saldoVencidoDesde') saldoVencidoDesde?: string,
    @Query('saldoVencidoHasta') saldoVencidoHasta?: string,
    @Query('ultimoPagoDesde') ultimoPagoDesde?: string,
    @Query('ultimoPagoHasta') ultimoPagoHasta?: string,
    @Query('estadoCuota') estadoCuota?: string,
    @Query('incluirTotal') incluirTotal?: string,
  ) {
    return this.service.findAll({
      limite: this.parseOptionalInteger(limit || limite) ?? 100,
      offset: this.parseOptionalInteger(offset) ?? 0,
      incluirTotal: this.parseBoolean(incluirTotal),
      idFraccion: this.parseOptionalNumber(idFraccion),
      nombreFraccion: this.normalizeText(nombreFraccion),
      idManzana: this.parseOptionalNumber(idManzana),
      idLote: this.parseOptionalNumber(idLote),
      numeroContrato: this.normalizeText(numeroContrato || contrato),
      sucursal: this.normalizeText(sucursal),
      nombreParaDocumento: this.normalizeText(nombreParaDocumento),
      idCliente: this.parseOptionalNumber(idCliente),
      documento: this.normalizeText(documento),
      numeroCuota: this.parseOptionalNumber(numeroCuota),
      numeroCuotaDesde: this.parseOptionalNumber(numeroCuotaDesde),
      numeroCuotaHasta: this.parseOptionalNumber(numeroCuotaHasta),
      totalCuotas: this.parseOptionalNumber(totalCuotas),
      estadoActualContrato: this.normalizeText(
        estadoActualContrato || estadoContrato,
      ),
      montoCuotaDesde: this.parseOptionalNumber(montoCuotaDesde),
      montoCuotaHasta: this.parseOptionalNumber(montoCuotaHasta),
      moraCuotaDesde: this.parseOptionalNumber(moraCuotaDesde),
      moraCuotaHasta: this.parseOptionalNumber(moraCuotaHasta),
      fechaVencimientoDesde,
      fechaVencimientoHasta,
      mesesMora: this.parseOptionalNumber(mesesMora),
      mesesMoraDesde: this.parseOptionalNumber(mesesMoraDesde),
      mesesMoraHasta: this.parseOptionalNumber(mesesMoraHasta),
      fechaPagoDesde,
      fechaPagoHasta,
      moneda: this.normalizeText(moneda),
      nroFactura: this.normalizeText(nroFactura),
      formaPago: this.normalizeText(formaPago),
      fecContratoDesde,
      fecContratoHasta,
      fecTratoDesde,
      fecTratoHasta,
      vendedor: this.normalizeText(vendedor),
      planPagoVendedor: this.normalizeText(planPagoVendedor),
      refinanciacion: this.normalizeText(refinanciacion),
      cancelacionAnticipada: this.normalizeText(cancelacionAnticipada),
      saldoVencidoDesde: this.parseOptionalNumber(saldoVencidoDesde),
      saldoVencidoHasta: this.parseOptionalNumber(saldoVencidoHasta),
      ultimoPagoDesde,
      ultimoPagoHasta,
      estadoCuota: this.normalizeText(estadoCuota),
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

  private parseOptionalNumber(value?: string): number | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(
        `El valor "${value}" no es un numero valido`,
      );
    }

    return parsed;
  }

  private normalizeText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }
}

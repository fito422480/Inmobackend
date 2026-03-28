import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CuotasVencidasEntity } from './cuotas-vencidas.entity';
import { PaginacionDto, PaginacionResponseDto } from './cuotas-vencidas.dto';

type CursorPayload = {
  mm: number;
  fv: string;
  nc: string;
  nq: number;
};

type CuotasVencidasRow = CuotasVencidasEntity;

@Injectable()
export class CuotasVencidasService {
  private static readonly NULL_DATE_CURSOR = '9999-12-31 23:59:59';
  private static readonly NULL_MORA_CURSOR = -1;

  constructor(
    @InjectRepository(CuotasVencidasEntity)
    private repo: Repository<CuotasVencidasEntity>,
  ) {}

  async findAll(
    dto: PaginacionDto,
  ): Promise<PaginacionResponseDto<CuotasVencidasEntity>> {
    const limite = Math.min(Math.max(dto.limite || 100, 1), 100000);
    const incluirTotal = dto.incluirTotal === true;
    const usarCursor = dto.cursor !== undefined || dto.offset === undefined;

    if (usarCursor) {
      return this.findAllByCursor(dto, limite, incluirTotal);
    }

    const offset = Math.max(dto.offset || 0, 0);
    return this.findAllByOffset(dto, limite, offset, incluirTotal);
  }

  private async findAllByOffset(
    dto: PaginacionDto,
    limite: number,
    offset: number,
    incluirTotal: boolean,
  ): Promise<PaginacionResponseDto<CuotasVencidasEntity>> {
    const pagina = Math.floor(offset / limite) + 1;

    const qb = this.repo.createQueryBuilder('v');
    this.applyFilters(qb, dto);
    const dataQb = this.selectDataColumns(qb.clone());

    if (!incluirTotal) {
      const data = await this.applyOrder(dataQb)
        .skip(offset)
        .take(limite + 1)
        .getRawMany<CuotasVencidasRow>();

      const tieneMas = data.length > limite;

      return {
        data: data.slice(0, limite),
        total: null,
        limite,
        offset,
        pagina,
        totalPaginas: null,
        incluirTotal: false,
        modoPaginacion: 'offset',
        cursorActual: null,
        nextCursor: null,
        tieneMas,
      };
    }

    const [total, data] = await Promise.all([
      qb.clone().getCount(),
      this.applyOrder(this.selectDataColumns(qb.clone()))
        .skip(offset)
        .take(limite)
        .getRawMany<CuotasVencidasRow>(),
    ]);

    return {
      data,
      total,
      limite,
      offset,
      pagina,
      totalPaginas: Math.ceil(total / limite),
      incluirTotal: true,
      modoPaginacion: 'offset',
      cursorActual: null,
      nextCursor: null,
    };
  }

  private async findAllByCursor(
    dto: PaginacionDto,
    limite: number,
    incluirTotal: boolean,
  ): Promise<PaginacionResponseDto<CuotasVencidasRow>> {
    const baseQb = this.repo.createQueryBuilder('v');
    this.applyFilters(baseQb, dto);

    const dataQb = this.selectDataColumns(baseQb.clone());
    if (dto.cursor) {
      const cursor = this.decodeCursor(dto.cursor);
      this.applyCursorFilter(dataQb, cursor);
    }

    const dataPromise = this.applyOrder(dataQb)
      .take(limite + 1)
      .getRawMany<CuotasVencidasRow>();
    const totalPromise = incluirTotal ? baseQb.clone().getCount() : Promise.resolve(null);

    const [total, rows] = await Promise.all([totalPromise, dataPromise]);
    const tieneMas = rows.length > limite;
    const data = rows.slice(0, limite);
    const lastItem = data[data.length - 1];
    const nextCursor = tieneMas && lastItem ? this.encodeCursor(lastItem) : null;

    return {
      data,
      total,
      limite,
      offset: null,
      pagina: null,
      totalPaginas: total !== null ? Math.ceil(total / limite) : null,
      incluirTotal,
      modoPaginacion: 'cursor',
      cursorActual: dto.cursor ?? null,
      nextCursor,
      tieneMas,
    };
  }

  private applyFilters(
    qb: SelectQueryBuilder<CuotasVencidasEntity>,
    dto: PaginacionDto,
  ) {
    if (
      dto.mesesMoraHasta !== undefined &&
      dto.mesesMoraHastaExclusivo !== undefined
    ) {
      throw new BadRequestException(
        'No puedes enviar mesesMoraHasta y mesesMoraHastaExclusivo al mismo tiempo',
      );
    }

    const fechaVencimientoDesde =
      dto.fechaVencimientoDesde ?? dto.fechaDesde;
    const fechaVencimientoHasta =
      dto.fechaVencimientoHasta ?? dto.fechaHasta;

    if (dto.numeroContrato) {
      qb.andWhere('v.numeroContrato = :numeroContrato', {
        numeroContrato: dto.numeroContrato,
      });
    }

    if (dto.documento) {
      qb.andWhere('v.documento = :documento', {
        documento: dto.documento,
      });
    }

    if (dto.idCliente) {
      qb.andWhere('v.idCliente = :idCliente', {
        idCliente: dto.idCliente,
      });
    }

    if (dto.sucursal) {
      qb.andWhere('v.sucursal = :sucursal', {
        sucursal: dto.sucursal,
      });
    }

    if (dto.estado) {
      qb.andWhere('v.estado = :estado', {
        estado: dto.estado,
      });
    }

    if (dto.estadoContrato) {
      qb.andWhere('v.estadoContrato = :estadoContrato', {
        estadoContrato: dto.estadoContrato,
      });
    }

    if (dto.estadoCuota) {
      qb.andWhere('v.estadoCuota = :estadoCuota', {
        estadoCuota: dto.estadoCuota,
      });
    }

    if (dto.vendedor) {
      qb.andWhere('v.vendedor = :vendedor', {
        vendedor: dto.vendedor,
      });
    }

    if (dto.mesesMoraDesde !== undefined) {
      qb.andWhere('v.mesesMora >= :mesesMoraDesde', {
        mesesMoraDesde: dto.mesesMoraDesde,
      });
    }

    if (dto.mesesMoraHasta !== undefined) {
      qb.andWhere('v.mesesMora <= :mesesMoraHasta', {
        mesesMoraHasta: dto.mesesMoraHasta,
      });
    }

    if (dto.mesesMoraHastaExclusivo !== undefined) {
      qb.andWhere('v.mesesMora < :mesesMoraHastaExclusivo', {
        mesesMoraHastaExclusivo: dto.mesesMoraHastaExclusivo,
      });
    }

    if (fechaVencimientoDesde) {
      qb.andWhere(
        "v.fechaVencimiento >= TO_DATE(:fechaVencimientoDesde, 'YYYY-MM-DD')",
        { fechaVencimientoDesde },
      );
    }

    if (fechaVencimientoHasta) {
      qb.andWhere(
        "v.fechaVencimiento <= TO_DATE(:fechaVencimientoHasta, 'YYYY-MM-DD')",
        { fechaVencimientoHasta },
      );
    }

    if (dto.ultimoPagoDesde) {
      qb.andWhere(
        "v.ultimoPago >= TO_DATE(:ultimoPagoDesde, 'YYYY-MM-DD')",
        { ultimoPagoDesde: dto.ultimoPagoDesde },
      );
    }

    if (dto.ultimoPagoHasta) {
      qb.andWhere(
        "v.ultimoPago <= TO_DATE(:ultimoPagoHasta, 'YYYY-MM-DD')",
        { ultimoPagoHasta: dto.ultimoPagoHasta },
      );
    }
  }

  private applyOrder(qb: SelectQueryBuilder<CuotasVencidasEntity>) {
    const moraExpr = 'NVL(v.mesesMora, -1)';

    return qb
      .orderBy(moraExpr, 'DESC')
      .addOrderBy("NVL(v.fechaVencimiento, DATE '9999-12-31')", 'ASC')
      .addOrderBy('v.numeroContrato', 'ASC')
      .addOrderBy('v.numeroCuota', 'ASC');
  }

  private selectDataColumns(qb: SelectQueryBuilder<CuotasVencidasEntity>) {
    return qb
      .select('v.idFraccion', 'idFraccion')
      .addSelect('v.nombreFraccion', 'nombreFraccion')
      .addSelect('v.idManzana', 'idManzana')
      .addSelect('v.idLote', 'idLote')
      .addSelect('v.numeroContrato', 'numeroContrato')
      .addSelect('v.fecContrato', 'fecContrato')
      .addSelect('v.fecTrato', 'fecTrato')
      .addSelect('v.sucursal', 'sucursal')
      .addSelect('v.nombreParaDocumento', 'nombreParaDocumento')
      .addSelect('v.idCliente', 'idCliente')
      .addSelect('v.documento', 'documento')
      .addSelect('v.numeroCuota', 'numeroCuota')
      .addSelect('v.estado', 'estado')
      .addSelect('v.montoCuota', 'montoCuota')
      .addSelect('v.plazo', 'plazo')
      .addSelect('v.moraCuota', 'moraCuota')
      .addSelect('v.fechaVencimiento', 'fechaVencimiento')
      .addSelect('v.mesesMora', 'mesesMora')
      .addSelect('v.ultimoPago', 'ultimoPago')
      .addSelect('v.saldoVencido', 'saldoVencido')
      .addSelect('v.telefonoCelular', 'telefonoCelular')
      .addSelect('v.estadoContrato', 'estadoContrato')
      .addSelect('v.vendedor', 'vendedor')
      .addSelect('v.estadoCuota', 'estadoCuota');
  }

  private applyCursorFilter(
    qb: SelectQueryBuilder<CuotasVencidasEntity>,
    cursor: CursorPayload,
  ) {
    const moraExpr = 'NVL(v.mesesMora, -1)';
    const fechaExpr = "NVL(v.fechaVencimiento, DATE '9999-12-31')";

    qb.andWhere(
      `(
        ${moraExpr} < :cursorMesesMora
        OR (
          ${moraExpr} = :cursorMesesMora
          AND ${fechaExpr} > TO_DATE(:cursorFechaVencimiento, 'YYYY-MM-DD HH24:MI:SS')
        )
        OR (
          ${moraExpr} = :cursorMesesMora
          AND
          ${fechaExpr} = TO_DATE(:cursorFechaVencimiento, 'YYYY-MM-DD HH24:MI:SS')
          AND v.numeroContrato > :cursorNumeroContrato
        )
        OR (
          ${moraExpr} = :cursorMesesMora
          AND ${fechaExpr} = TO_DATE(:cursorFechaVencimiento, 'YYYY-MM-DD HH24:MI:SS')
          AND v.numeroContrato = :cursorNumeroContrato
          AND v.numeroCuota > :cursorNumeroCuota
        )
      )`,
      {
        cursorMesesMora: cursor.mm,
        cursorFechaVencimiento: cursor.fv,
        cursorNumeroContrato: cursor.nc,
        cursorNumeroCuota: cursor.nq,
      },
    );
  }

  private encodeCursor(item: CuotasVencidasRow): string {
    const payload: CursorPayload = {
      mm: this.formatCursorMora(item.mesesMora),
      fv: this.formatCursorDate(item.fechaVencimiento),
      nc: item.numeroContrato ?? '',
      nq: Number(item.numeroCuota ?? 0),
    };

    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): CursorPayload {
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as Partial<CursorPayload>;

      if (
        typeof parsed.mm !== 'number' ||
        typeof parsed.fv !== 'string' ||
        typeof parsed.nc !== 'string' ||
        typeof parsed.nq !== 'number'
      ) {
        throw new Error('Cursor incompleto');
      }

      return {
        mm: parsed.mm,
        fv: parsed.fv,
        nc: parsed.nc,
        nq: parsed.nq,
      };
    } catch {
      throw new BadRequestException('Cursor inválido');
    }
  }

  private formatCursorDate(value?: Date | string | null): string {
    if (!value) {
      return CuotasVencidasService.NULL_DATE_CURSOR;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('No se pudo construir el cursor de fecha');
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    const seconds = `${date.getSeconds()}`.padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private formatCursorMora(value?: number | string | null): number {
    if (value === null || value === undefined || value === '') {
      return CuotasVencidasService.NULL_MORA_CURSOR;
    }

    const mora = Number(value);
    if (Number.isNaN(mora)) {
      throw new BadRequestException('No se pudo construir el cursor de mesesMora');
    }

    return mora;
  }
}


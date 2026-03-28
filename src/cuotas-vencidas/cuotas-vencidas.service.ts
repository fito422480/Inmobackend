import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CuotasVencidasEntity } from './cuotas-vencidas.entity';
import { PaginacionDto, PaginacionResponseDto } from './cuotas-vencidas.dto';

@Injectable()
export class CuotasVencidasService {
  constructor(
    @InjectRepository(CuotasVencidasEntity)
    private repo: Repository<CuotasVencidasEntity>,
  ) {}

  async findAll(
    dto: PaginacionDto,
  ): Promise<PaginacionResponseDto<CuotasVencidasEntity>> {
    const limite = Math.min(Math.max(dto.limite || 100, 1), 1000);
    const offset = Math.max(dto.offset || 0, 0);
    const incluirTotal = dto.incluirTotal === true;
    const pagina = Math.floor(offset / limite) + 1;

    const qb = this.repo.createQueryBuilder('v');
    this.applyFilters(qb, dto);

    if (!incluirTotal) {
      const data = await this.applyOrder(qb.clone())
        .skip(offset)
        .take(limite + 1)
        .getMany();

      const tieneMas = data.length > limite;

      return {
        data: data.slice(0, limite),
        total: null,
        limite,
        offset,
        pagina,
        totalPaginas: null,
        incluirTotal: false,
        tieneMas,
      };
    }

    const [total, data] = await Promise.all([
      qb.clone().getCount(),
      this.applyOrder(qb.clone()).skip(offset).take(limite).getMany(),
    ]);

    return {
      data,
      total,
      limite,
      offset,
      pagina,
      totalPaginas: Math.ceil(total / limite),
      incluirTotal: true,
    };
  }

  private applyFilters(
    qb: SelectQueryBuilder<CuotasVencidasEntity>,
    dto: PaginacionDto,
  ) {
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

    if (dto.fechaVencimientoDesde) {
      qb.andWhere(
        "v.fechaVencimiento >= TO_DATE(:fechaVencimientoDesde, 'YYYY-MM-DD')",
        { fechaVencimientoDesde: dto.fechaVencimientoDesde },
      );
    }

    if (dto.fechaVencimientoHasta) {
      qb.andWhere(
        "v.fechaVencimiento <= TO_DATE(:fechaVencimientoHasta, 'YYYY-MM-DD')",
        { fechaVencimientoHasta: dto.fechaVencimientoHasta },
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
    return qb
      .orderBy('v.fechaVencimiento', 'ASC')
      .addOrderBy('v.numeroContrato', 'ASC')
      .addOrderBy('v.numeroCuota', 'ASC');
  }
}

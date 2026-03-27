import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CuotasPagadasEntity } from './cuotas-pagadas.entity';
import { PaginacionDto, PaginacionResponseDto } from './cuotas-pagadas.dto';

@Injectable()
export class CuotasPagadasService {
  constructor(
    @InjectRepository(CuotasPagadasEntity)
    private repo: Repository<CuotasPagadasEntity>,
    private dataSource: DataSource,
  ) {}

  async findAll(dto: PaginacionDto): Promise<PaginacionResponseDto<CuotasPagadasEntity>> {
    const limite = Math.min(dto.limite || 100, 1000); // máximo 1000 por página
    const offset = Math.max(dto.offset || 0, 0);
    const incluirTotal = dto.incluirTotal !== false;
    const pagina = Math.floor(offset / limite) + 1;

    // ── Construcción dinámica de filtros ──────────────────────────────────────
    const qb = this.repo.createQueryBuilder('v');

    if (dto.numeroContrato) {
      qb.andWhere('v.numeroContrato = :numeroContrato', { numeroContrato: dto.numeroContrato });
    }
    if (dto.documento) {
      qb.andWhere('v.documento = :documento', { documento: dto.documento });
    }
    if (dto.idCliente) {
      qb.andWhere('v.idCliente = :idCliente', { idCliente: dto.idCliente });
    }
    if (dto.sucursal) {
      qb.andWhere('v.sucursal = :sucursal', { sucursal: dto.sucursal });
    }
    if (dto.estadoActualContrato) {
      qb.andWhere('v.estadoActualContrato = :estado', { estado: dto.estadoActualContrato });
    }
    if (dto.moneda) {
      qb.andWhere('v.moneda = :moneda', { moneda: dto.moneda });
    }
    if (dto.fechaDesde) {
      qb.andWhere('v.fechaPago >= TO_DATE(:fechaDesde, \'YYYY-MM-DD\')', { fechaDesde: dto.fechaDesde });
    }
    if (dto.fechaHasta) {
      qb.andWhere('v.fechaPago <= TO_DATE(:fechaHasta, \'YYYY-MM-DD\')', { fechaHasta: dto.fechaHasta });
    }

    if (!incluirTotal) {
      const data = await qb
        .clone()
        .orderBy('v.fechaPago', 'DESC')
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

    // ── Ejecutar conteo y página en paralelo para bajar latencia total ───────
    const [total, data] = await Promise.all([
      qb.clone().getCount(),
      qb
        .clone()
        .orderBy('v.fechaPago', 'DESC')
        .skip(offset)
        .take(limite)
        .getMany(),
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

  // ── Método alternativo con SQL nativo para Oracle 11g o mejor rendimiento ──
  async findAllNativo(dto: PaginacionDto): Promise<PaginacionResponseDto<any>> {
    const limite = Math.min(dto.limite || 100, 1000);
    const offset = dto.offset || 0;

    // Parámetros dinámicos
    const params: any = { limite, offset };
    const filtros: string[] = [];

    if (dto.numeroContrato) {
      filtros.push(`NUMERO_CONTRATO = :numeroContrato`);
      params.numeroContrato = dto.numeroContrato;
    }
    if (dto.documento) {
      filtros.push(`DOCUMENTO = :documento`);
      params.documento = dto.documento;
    }
    if (dto.idCliente) {
      filtros.push(`ID_CLIENTE = :idCliente`);
      params.idCliente = dto.idCliente;
    }
    if (dto.sucursal) {
      filtros.push(`SUCURSAL = :sucursal`);
      params.sucursal = dto.sucursal;
    }
    if (dto.estadoActualContrato) {
      filtros.push(`ESTADO_ACTUAL_CONTRATO = :estado`);
      params.estado = dto.estadoActualContrato;
    }
    if (dto.moneda) {
      filtros.push(`MONEDA = :moneda`);
      params.moneda = dto.moneda;
    }
    if (dto.fechaDesde) {
      filtros.push(`FECHA_PAGO >= TO_DATE(:fechaDesde, 'YYYY-MM-DD')`);
      params.fechaDesde = dto.fechaDesde;
    }
    if (dto.fechaHasta) {
      filtros.push(`FECHA_PAGO <= TO_DATE(:fechaHasta, 'YYYY-MM-DD')`);
      params.fechaHasta = dto.fechaHasta;
    }

    const whereClause = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

    // ROW_NUMBER() para compatibilidad con Oracle 11g también
    const sqlData = `
      SELECT *
      FROM (
        SELECT v.*, ROW_NUMBER() OVER (ORDER BY FECHA_PAGO DESC) AS RN
        FROM ADCC.CBI_CUOTAS_PAGADAS_V v
        ${whereClause}
      )
      WHERE RN > :offset AND RN <= (:offset + :limite)
    `;

    const sqlCount = `
      SELECT COUNT(*) AS TOTAL
      FROM ADCC.CBI_CUOTAS_PAGADAS_V
      ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      this.dataSource.query(sqlData, params),
      this.dataSource.query(sqlCount, params),
    ]);

    const total = parseInt(countResult[0]?.TOTAL || '0');

    return {
      data: dataResult,
      total,
      limite,
      offset,
      pagina: Math.floor(offset / limite) + 1,
      totalPaginas: Math.ceil(total / limite),
      incluirTotal: true,
    };
  }
}

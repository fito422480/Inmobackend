import assert = require('node:assert/strict');
import { describe, it } from 'node:test';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { MetasController } from './metas.controller';
import { buildMetasPeriodo, MetasService } from './metas.service';

type QueryCall = {
  sql: string;
  params: Record<string, unknown>;
};

describe('buildMetasPeriodo', () => {
  it('calcula el cierre de agosto y el cierre del mes anterior', () => {
    assert.deepEqual(buildMetasPeriodo('2026-08'), {
      mes: '2026-08',
      fechaInicio: '2026-08-01',
      fechaFin: '2026-08-31',
      fechaFinMesAnterior: '2026-07-31',
    });
  });

  it('maneja febrero bisiesto y el cambio de anio', () => {
    assert.equal(buildMetasPeriodo('2024-02').fechaFin, '2024-02-29');
    assert.equal(
      buildMetasPeriodo('2026-01').fechaFinMesAnterior,
      '2025-12-31',
    );
  });

  it('rechaza periodos inexistentes o con formato incompleto', () => {
    for (const mes of [
      '2026-8',
      '2026-13',
      '1899-12',
      '9999-12',
      'texto',
    ]) {
      assert.throws(() => buildMetasPeriodo(mes), BadRequestException);
    }
  });
});

describe('MetasService', () => {
  it('ejecuta una sola consulta con binds y devuelve cada componente', async () => {
    const { service, calls } = createService([
      {
        MATI_IMPORTE: '1000.50',
        JESUS_IMPORTE: 200,
        JESUS_VENCIDO: '300',
        FERNANDO_IMPORTE: null,
        FERNANDO_VENCIDO: '400.25',
        JUDICIALES_IMPORTE: 50,
        JUDICIALES_VENCIDO: '60',
      },
    ]);

    const response = await service.calcular({ mes: '2026-08' });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].params, {
      mesInicio: '2026-08-01',
      estadoActivo: 'Activo',
      estadoBloqueado: 'Bloqueado',
    });

    const sql = calls[0].sql.replace(/\s+/g, ' ').trim();
    assert.match(sql, /FROM ADCC\.CBI_INMC093_FOTO_V v/);
    assert.match(sql, /v\.ESTADO IN \(:estadoActivo, :estadoBloqueado\)/);
    assertAggregateCase(
      sql,
      [
        'v.MESES_ATRASO = 0',
        "v.VENCIMIENTO < ADD_MONTHS(TO_DATE(:mesInicio, 'YYYY-MM-DD'), 1)",
        'NOT ( v.CUOTA = v.PLAZO',
        "v.VENCIMIENTO < TO_DATE(:mesInicio, 'YYYY-MM-DD') )",
      ],
      'v.IMPORTE_CUOTA',
      'MATI_IMPORTE',
    );
    assertAggregateCase(
      sql,
      [
        'v.MESES_ATRASO > 0',
        'v.MESES_ATRASO < 3',
        '(v.PLAZO - v.CUOTA) <> 1',
      ],
      'v.IMPORTE_CUOTA',
      'JESUS_IMPORTE',
    );
    assertAggregateCase(
      sql,
      [
        'v.MESES_ATRASO > 0',
        'v.MESES_ATRASO < 3',
        '(v.PLAZO - v.CUOTA) <> 1',
      ],
      'v.SALDO_VENCIDO',
      'JESUS_VENCIDO',
    );
    assertAggregateCase(
      sql,
      ['v.MESES_ATRASO > 2', 'v.MESES_ATRASO < 11'],
      'v.IMPORTE_CUOTA',
      'FERNANDO_IMPORTE',
    );
    assertAggregateCase(
      sql,
      ['v.MESES_ATRASO > 2', 'v.MESES_ATRASO < 11'],
      'v.SALDO_VENCIDO',
      'FERNANDO_VENCIDO',
    );
    assertAggregateCase(
      sql,
      ['v.MESES_ATRASO > 10', 'v.CUOTA <> v.PLAZO'],
      'v.IMPORTE_CUOTA',
      'JUDICIALES_IMPORTE',
    );
    assertAggregateCase(
      sql,
      ['v.MESES_ATRASO > 10', 'v.CUOTA <> v.PLAZO'],
      'v.SALDO_VENCIDO',
      'JUDICIALES_VENCIDO',
    );

    assert.deepEqual(response.periodo, {
      mes: '2026-08',
      fechaInicio: '2026-08-01',
      fechaFin: '2026-08-31',
      fechaFinMesAnterior: '2026-07-31',
    });
    assert.deepEqual(
      response.data.map((item) => ({
        codigo: item.codigo,
        importeCuotas: item.importeCuotas,
        saldoVencido: item.saldoVencido,
        valorCartera: item.valorCartera,
      })),
      [
        {
          codigo: 'MATI',
          importeCuotas: 1000.5,
          saldoVencido: 0,
          valorCartera: 1000.5,
        },
        {
          codigo: 'JESUS',
          importeCuotas: 200,
          saldoVencido: 300,
          valorCartera: 500,
        },
        {
          codigo: 'FERNANDO',
          importeCuotas: 0,
          saldoVencido: 400.25,
          valorCartera: 400.25,
        },
        {
          codigo: 'JUDICIALES',
          importeCuotas: 50,
          saldoVencido: 60,
          valorCartera: 110,
        },
      ],
    );
    assert.equal(response.totalCartera, 2010.75);

    await service.calcular({ mes: '2026-08' });
    assert.equal(calls.length, 1, 'la segunda llamada debe usar el cache');
  });

  it('normaliza a cero cuando Oracle no devuelve valores', async () => {
    const { service } = createService([]);

    const response = await service.calcular({ mes: '2026-02' });

    assert.equal(response.data.length, 4);
    assert.ok(
      response.data.every(
        (item) =>
          item.importeCuotas === 0 &&
          item.saldoVencido === 0 &&
          item.valorCartera === 0,
      ),
    );
    assert.equal(response.totalCartera, 0);
  });

  it('rechaza un mes repetido en la query', async () => {
    const { service, calls } = createService([]);

    await assert.rejects(
      () => service.calcular({ mes: ['2026-08', '2026-09'] } as any),
      BadRequestException,
    );
    assert.equal(calls.length, 0);
  });

  it('traduce una vista Oracle ausente a servicio no disponible', async () => {
    const { service } = createService([], {
      queryError: Object.assign(new Error('ORA-00942: table or view does not exist'), {
        code: 'ORA-00942',
      }),
    });

    await assert.rejects(
      () => service.calcular({ mes: '2026-08' }),
      ServiceUnavailableException,
    );
  });
});

describe('MetasController', () => {
  it('envia el mes recibido al servicio', async () => {
    let receivedMonth: string | undefined;
    const expected = { ok: true };
    const service = {
      calcular: async ({ mes }: { mes?: string }) => {
        receivedMonth = mes;
        return expected;
      },
    } as unknown as MetasService;
    const controller = new MetasController(service);

    const response = await controller.calcular('2026-08');

    assert.equal(receivedMonth, '2026-08');
    assert.equal(response, expected);
  });
});

function createService(
  rows: Record<string, unknown>[],
  options: { queryError?: Error } = {},
): { service: MetasService; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const dataSource = {
    query: async (sql: string, params: Record<string, unknown>) => {
      calls.push({ sql, params });
      if (options.queryError) {
        throw options.queryError;
      }
      return rows;
    },
  } as unknown as DataSource;
  const configService = {
    get: (key: string) => {
      if (key === 'METAS_CACHE_TTL_MS') return 15000;
      if (key === 'METAS_CACHE_MAX_ITEMS') return 24;
      if (key === 'METAS_TIME_ZONE') return 'America/Asuncion';
      return undefined;
    },
  } as unknown as ConfigService;

  return {
    service: new MetasService(dataSource, configService),
    calls,
  };
}

function assertAggregateCase(
  sql: string,
  conditions: string[],
  valueColumn: string,
  alias: string,
) {
  const condition = conditions.join(' AND ');
  const expected =
    `NVL(SUM(CASE WHEN ${condition} ` +
    `THEN NVL(${valueColumn}, 0) ELSE 0 END), 0) AS ${alias}`;

  assert.ok(
    sql.includes(expected),
    `No se encontro la regla completa de ${alias}`,
  );
}

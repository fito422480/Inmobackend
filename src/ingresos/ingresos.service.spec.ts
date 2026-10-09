import assert = require('node:assert/strict');
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { IngresosEntity } from './ingresos.entity';
import { IngresosService } from './ingresos.service';

type QueryCall = { sql: string; params: unknown[] };

function createService(rows: Record<string, unknown>[]) {
  const calls: QueryCall[] = [];
  const repo = {
    query: (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return Promise.resolve(rows);
    },
  } as unknown as Repository<IngresosEntity>;
  const service = new IngresosService(repo, new ConfigService({}));
  return { service, calls };
}

// Valores reales del 2026-10-05 (deduplicados por documento) contra el arqueo.
const FILAS_05_10 = [
  { FECHA: '2026-10-05', CATEGORIA: 'RECIBO_CUOTAS', CUENTA: 'CAJA OVIEDO', MONEDA: 'GUARANI', DOCUMENTOS: 64, TOTAL: 43404500 },
  { FECHA: '2026-10-05', CATEGORIA: 'RECIBO_CUOTAS', CUENTA: 'BANCARD', MONEDA: 'GUARANI', DOCUMENTOS: 447, TOTAL: 401400100 },
  { FECHA: '2026-10-05', CATEGORIA: 'INTERESES', CUENTA: 'CAJA OVIEDO', MONEDA: 'GUARANI', DOCUMENTOS: 81, TOTAL: 5463755 },
  { FECHA: '2026-10-05', CATEGORIA: 'INTERESES', CUENTA: 'CAJA CAAGUAZU', MONEDA: 'GUARANI', DOCUMENTOS: 56, TOTAL: 1705857 },
  { FECHA: '2026-10-05', CATEGORIA: 'GESTION_COBRANZAS', CUENTA: 'CAJA OVIEDO', MONEDA: 'GUARANI', DOCUMENTOS: 7, TOTAL: 325159 },
  { FECHA: '2026-10-05', CATEGORIA: 'CESION_DERECHOS', CUENTA: 'CAJA OVIEDO', MONEDA: 'GUARANI', DOCUMENTOS: 3, TOTAL: 1650000 },
  { FECHA: '2026-10-05', CATEGORIA: 'OTROS_INGRESOS', CUENTA: 'CAJA SAN LORENZO', MONEDA: 'GUARANI', DOCUMENTOS: 1, TOTAL: 1800000 },
  { FECHA: '2026-10-05', CATEGORIA: 'FACTURACION_PROPIETARIOS', CONCEPTO: 'ADMINISTRACION+INTERESES+VENTAS', CUENTA: 'CENTRAL PROP.', MONEDA: 'GUARANI', DOCUMENTOS: 1, TOTAL: 219542447 },
  { FECHA: '2026-10-05', CATEGORIA: 'NOTA_CREDITO', CUENTA: 'CAJA SAN LORENZO', MONEDA: 'GUARANI', DOCUMENTOS: 3, TOTAL: 1548000 },
];

describe('IngresosService.ingresosDia', () => {
  it('arma el resumen por fecha y no mezcla facturacion a propietarios ni notas de credito en el ingreso operativo', async () => {
    const { service, calls } = createService(FILAS_05_10);
    const res = await service.ingresosDia({ fechaDesde: '2026-10-05', fechaHasta: '2026-10-05' });

    assert.equal(res.resumenPorFecha.length, 1);
    const r = res.resumenPorFecha[0];
    assert.equal(r.cuotas, 444804600);
    assert.equal(r.intereses, 7169612);
    assert.equal(r.gestionCobranzas + r.cesionDerechos + r.otrosIngresos, 3775159);
    assert.equal(r.ingresoOperativo, 444804600 + 7169612 + 3775159);
    assert.equal(r.facturacionPropietarios, 219542447);
    assert.equal(r.notasCredito, 1548000);
    assert.deepEqual(calls[0].params, ['2026-10-05', '2026-10-05']);
    const prop = res.data.find((x) => x.categoria === 'FACTURACION_PROPIETARIOS');
    assert.equal(prop?.concepto, 'ADMINISTRACION+INTERESES+VENTAS');
    assert.equal(res.data.find((x) => x.categoria === 'INTERESES')?.concepto, null);
  });

  it('clasifica mirando todas las lineas de la factura y separa los conceptos de propietarios', async () => {
    const { service, calls } = createService([]);
    await service.ingresosDia({ fechaDesde: '2026-10-05', fechaHasta: '2026-10-05' });
    const sql = calls[0].sql;
    assert.match(sql, /f_adm/);
    assert.match(sql, /WHEN f_gestion = 1 THEN 'GESTION_COBRANZAS'/);
    assert.match(sql, /f_recupero/);
    assert.match(sql, /RECUPERO_GASTOS/);
    assert.match(sql, /GROUP BY TO_CHAR\(fecha_documento, 'YYYY-MM-DD'\), categoria, concepto/);
  });

  it('deduplica por documento en el SQL y excluye lo que no es ingreso', async () => {
    const { service, calls } = createService([]);
    await service.ingresosDia({ fechaDesde: '2026-10-05', fechaHasta: '2026-10-05' });
    const sql = calls[0].sql;
    assert.match(sql, /GROUP BY clave, tipo_mov/);
    assert.match(sql, /cta_bancaria IS NOT NULL/);
    assert.match(sql, /INMLIQPROP/);
    assert.doesNotMatch(sql, /tipo_mov LIKE '(12|13|47) -/);
  });

  it('reutiliza la cache en una segunda llamada identica', async () => {
    const { service, calls } = createService(FILAS_05_10);
    const q = { fechaDesde: '2026-10-05', fechaHasta: '2026-10-05' };
    await service.ingresosDia(q);
    await service.ingresosDia(q);
    assert.equal(calls.length, 1);
  });

  it('rechaza fechas faltantes, inexistentes, invertidas o rangos enormes', async () => {
    const { service } = createService([]);
    const casos = [
      { fechaDesde: '', fechaHasta: '' },
      { fechaDesde: '2026-02-30', fechaHasta: '2026-03-01' },
      { fechaDesde: '05/10/2026', fechaHasta: '2026-10-05' },
      { fechaDesde: '2026-10-06', fechaHasta: '2026-10-05' },
      { fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' },
    ];
    for (const c of casos) {
      await assert.rejects(() => service.ingresosDia(c), BadRequestException);
    }
  });
});

describe('IngresosService.detalle', () => {
  const base = { fechaDesde: '2026-10-05', fechaHasta: '2026-10-05' };

  it('pide limite+1 filas para saber si hay mas y recorta la respuesta', async () => {
    const filas = Array.from({ length: 3 }, (_, i) => ({
      FECHA: '2026-10-05', CATEGORIA: 'NOTA_CREDITO', NUMERO_DOCUMENTO: ` 001-001-000000${i}`,
      CUENTA: 'CAJA SAN LORENZO', MONEDA: 'GUARANI', ARTICULO: null, LINEAS: 1, TOTAL: 100, OBSERVACION: null,
    }));
    const { service, calls } = createService(filas);
    const res = await service.detalle({ ...base, categoria: 'nota_credito', limite: 2, offset: 0 });

    assert.equal(res.data.length, 2);
    assert.equal(res.tieneMas, true);
    assert.equal(res.data[0].numeroDocumento, '001-001-0000000');
    assert.deepEqual(calls[0].params, ['2026-10-05', '2026-10-05', 0, 3]);
    assert.match(calls[0].sql, /categoria = 'NOTA_CREDITO'/);
  });

  it('sin categoria excluye recibos y notas de credito', async () => {
    const { service, calls } = createService([]);
    await service.detalle(base);
    assert.match(calls[0].sql, /categoria NOT IN \('RECIBO_CUOTAS', 'NOTA_CREDITO'\)/);
  });

  it('rechaza categorias fuera de la lista (no se inyecta texto libre al SQL)', async () => {
    const { service, calls } = createService([]);
    await assert.rejects(
      () => service.detalle({ ...base, categoria: "X' OR 1=1 --" }),
      BadRequestException,
    );
    assert.equal(calls.length, 0);
  });
});

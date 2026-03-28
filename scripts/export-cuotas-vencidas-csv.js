const fs = require('fs');
const path = require('path');
const { once } = require('events');

const CSV_COLUMNS = [
  'idFraccion',
  'nombreFraccion',
  'idManzana',
  'idLote',
  'numeroContrato',
  'fecContrato',
  'fecTrato',
  'sucursal',
  'nombreParaDocumento',
  'idCliente',
  'documento',
  'numeroCuota',
  'estado',
  'montoCuota',
  'plazo',
  'moraCuota',
  'fechaVencimiento',
  'mesesMora',
  'ultimoPago',
  'saldoVencido',
  'telefonoCelular',
  'estadoContrato',
  'vendedor',
  'estadoCuota',
];

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!hasAnyFilter(options)) {
    throw new Error(
      'Debes indicar al menos un filtro, por ejemplo --mesesMoraDesde=0, --mesesMoraHastaExclusivo=31, --fechaDesde=YYYY-MM-DD o --ultimoPagoDesde=YYYY-MM-DD',
    );
  }

  if (
    options.mesesMoraHasta !== undefined &&
    options.mesesMoraHastaExclusivo !== undefined
  ) {
    throw new Error(
      'No puedes usar --mesesMoraHasta y --mesesMoraHastaExclusivo al mismo tiempo',
    );
  }

  const outputPath = path.resolve(options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  await writeCsvLine(stream, CSV_COLUMNS);

  let cursor = null;
  let totalRows = 0;
  let page = 0;
  const startedAt = Date.now();

  try {
    do {
      page += 1;
      const url = buildUrl(options, cursor);
      const payload = await fetchJsonWithRetry(url, options);
      const rows = Array.isArray(payload.data) ? payload.data : [];

      await writeCsvRows(stream, rows);

      totalRows += rows.length;
      cursor = payload.nextCursor ?? null;

      console.log(
        `[export-cuotas-vencidas] pagina=${page} rows=${rows.length} total=${totalRows} tieneMas=${Boolean(payload.tieneMas)}`,
      );

      if (!payload.tieneMas || !cursor) {
        break;
      }
    } while (true);
  } finally {
    stream.end();
    await once(stream, 'finish');
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[export-cuotas-vencidas] exportacion finalizada. filas=${totalRows} archivo=${outputPath} tiempo=${seconds}s`,
  );
}

function parseArgs(args) {
  const values = {
    baseUrl: 'http://localhost:3000/cuotas-vencidas',
    limit: '10000',
    retries: '5',
    timeoutMs: '120000',
    retryDelayMs: '2000',
    output: defaultOutputPath(),
  };

  for (const arg of args) {
    if (!arg.startsWith('--')) {
      continue;
    }

    const eqIndex = arg.indexOf('=');
    const key = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
    const value = eqIndex >= 0 ? arg.slice(eqIndex + 1) : 'true';
    values[key] = value;
  }

  return values;
}

function hasAnyFilter(options) {
  return [
    options.fechaDesde,
    options.fechaHasta,
    options.fechaVencimientoDesde,
    options.fechaVencimientoHasta,
    options.ultimoPagoDesde,
    options.ultimoPagoHasta,
    options.estadoCuota,
    options.estadoContrato,
    options.estado,
    options.mesesMoraDesde,
    options.mesesMoraHasta,
    options.mesesMoraHastaExclusivo,
    options.sucursal,
    options.documento,
    options.numeroContrato,
    options.vendedor,
  ].some((value) => value !== undefined && value !== null && value !== '');
}

async function fetchJsonWithRetry(url, options) {
  const retries = toPositiveInt(options.retries, 5);
  const retryDelayMs = toPositiveInt(options.retryDelayMs, 2000);

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      return await fetchJson(url, options);
    } catch (error) {
      if (attempt > retries) {
        throw new Error(
          `fetch failed tras ${attempt} intentos al consultar ${url}\n${error.message}`,
        );
      }

      const delayMs = retryDelayMs * attempt;
      console.warn(
        `[export-cuotas-vencidas] intento=${attempt} fallo=${error.message} reintentandoEnMs=${delayMs}`,
      );
      await sleep(delayMs);
    }
  }
}

async function fetchJson(url, options) {
  const timeoutMs = toPositiveInt(options.timeoutMs, 120000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status} al consultar ${url}\n${body}`);
    }

    return await response.json();
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`timeout de ${timeoutMs}ms al consultar ${url}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildUrl(options, cursor) {
  const url = new URL(options.baseUrl);
  url.searchParams.set('limit', String(toPositiveInt(options.limit, 10000)));

  setParam(url, 'fechaDesde', options.fechaDesde);
  setParam(url, 'fechaHasta', options.fechaHasta);
  setParam(url, 'fechaVencimientoDesde', options.fechaVencimientoDesde);
  setParam(url, 'fechaVencimientoHasta', options.fechaVencimientoHasta);
  setParam(url, 'ultimoPagoDesde', options.ultimoPagoDesde);
  setParam(url, 'ultimoPagoHasta', options.ultimoPagoHasta);
  setParam(url, 'estadoCuota', options.estadoCuota);
  setParam(url, 'estadoContrato', options.estadoContrato);
  setParam(url, 'estado', options.estado);
  setParam(url, 'mesesMoraDesde', options.mesesMoraDesde);
  setParam(url, 'mesesMoraHasta', options.mesesMoraHasta);
  setParam(url, 'mesesMoraHastaExclusivo', options.mesesMoraHastaExclusivo);
  setParam(url, 'sucursal', options.sucursal);
  setParam(url, 'documento', options.documento);
  setParam(url, 'numeroContrato', options.numeroContrato);
  setParam(url, 'vendedor', options.vendedor);

  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  return url.toString();
}

function setParam(url, key, value) {
  if (value !== undefined && value !== null && value !== '') {
    url.searchParams.set(key, String(value));
  }
}

function normalizeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function escapeCsv(value) {
  const normalized = String(value);

  if (
    normalized.includes(',') ||
    normalized.includes('"') ||
    normalized.includes('\n') ||
    normalized.includes('\r')
  ) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

async function writeCsvLine(stream, values) {
  const line = `${values.map(escapeCsv).join(',')}\n`;

  if (!stream.write(line)) {
    await once(stream, 'drain');
  }
}

async function writeCsvRows(stream, rows) {
  const batchSize = 1000;

  for (let index = 0; index < rows.length; index += batchSize) {
    const chunk = rows
      .slice(index, index + batchSize)
      .map((row) =>
        CSV_COLUMNS.map((column) => escapeCsv(normalizeCsvValue(row[column]))).join(','),
      )
      .join('\n');

    if (!chunk) {
      continue;
    }

    if (!stream.write(`${chunk}\n`)) {
      await once(stream, 'drain');
    }
  }
}

function defaultOutputPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join('exports', `cuotas-vencidas-${timestamp}.csv`);
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(`[export-cuotas-vencidas] ${error.message}`);
  process.exit(1);
});

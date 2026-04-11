const fs = require('fs');
const path = require('path');
const { once } = require('events');

loadEnvFile();

const CSV_COLUMNS = [
  'contrato',
  'fecContrato',
  'titular',
  'ciRuc',
  'telefono',
  'sucursal',
  'fraccion',
  'manzana',
  'lote',
  'padron',
  'vencimiento',
  'cuota',
  'importeCuota',
  'plazo',
  'ultimoPago',
  'fechaSenia',
  'mesesAtraso',
  'saldoVencido',
  'interes',
  'estado',
];

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.apiKey) {
    throw new Error('No se encontro API_KEY en .env');
  }

  if (
    options.mesesAtrasoDesde !== undefined &&
    options.mesesAtrasoHasta !== undefined &&
    Number(options.mesesAtrasoDesde) > Number(options.mesesAtrasoHasta)
  ) {
    throw new Error(
      '--mesesAtrasoDesde no puede ser mayor que --mesesAtrasoHasta',
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
        `[export-cobranzas] pagina=${page} rows=${rows.length} total=${totalRows} tieneMas=${Boolean(payload.tieneMas)}`,
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
    `[export-cobranzas] exportacion finalizada. filas=${totalRows} archivo=${outputPath} tiempo=${seconds}s`,
  );
}

function parseArgs(args) {
  const port = Number(process.env.APP_PORT) || 3000;
  const values = {
    baseUrl: `http://127.0.0.1:${port}/cobranzas`,
    limit: '100000',
    retries: '5',
    timeoutMs: '300000',
    retryDelayMs: '2000',
    output: defaultOutputPath(),
    apiKey: process.env.API_KEY || '',
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

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
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
        `[export-cobranzas] intento=${attempt} fallo=${error.message} reintentandoEnMs=${delayMs}`,
      );
      await sleep(delayMs);
    }
  }
}

async function fetchJson(url, options) {
  const timeoutMs = toPositiveInt(options.timeoutMs, 300000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {};

  if (options.apiKey) {
    headers['x-api-key'] = options.apiKey;
  }

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

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
  url.searchParams.set('limit', String(toPositiveInt(options.limit, 100000)));

  setParam(url, 'estado', options.estado);
  setParam(url, 'mesesAtrasoDesde', options.mesesAtrasoDesde);
  setParam(url, 'mesesAtrasoHasta', options.mesesAtrasoHasta);

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
        CSV_COLUMNS.map((column) =>
          escapeCsv(normalizeCsvValue(row[column])),
        ).join(','),
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
  return path.join('exports', `cobranzas-${timestamp}.csv`);
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
  console.error(`[export-cobranzas] ${error.message}`);
  process.exit(1);
});

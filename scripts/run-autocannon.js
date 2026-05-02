const fs = require('fs');
const path = require('path');
const autocannon = require('autocannon');

const args = process.argv.slice(2);

const PRESETS = {
  clientes: '/clientes?limite=100&offset=0',
  lotes: '/lotes?limite=100&offset=0',
  cuotasPagadas: '/cuotas-pagadas?limite=100&offset=0&incluirTotal=false',
  cuotasVencidas: '/cuotas-vencidas?limit=100&incluirTotal=false',
  estadoCuentas: '/estado-cuentas?limit=100&incluirTotal=false',
};

loadEnvFile();

function getOption(name, fallback) {
  const prefix = `${name}=`;
  const arg = args.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildUrl(target, baseUrl) {
  if (!target) {
    return null;
  }

  if (PRESETS[target]) {
    return `${baseUrl}${PRESETS[target]}`;
  }

  if (target.startsWith('http://') || target.startsWith('https://')) {
    return target;
  }

  if (target.startsWith('/')) {
    return `${baseUrl}${target}`;
  }

  return null;
}

function printHelp() {
  console.log(`
Uso:
  node scripts/run-autocannon.js <preset|url|path> [opciones]

Presets disponibles:
  clientes
  lotes
  cuotasPagadas
  cuotasVencidas
  estadoCuentas

Opciones:
  --base-url=http://127.0.0.1:3000
  --connections=20
  --duration=30
  --timeout=60
  --pipelining=1
  --api-key=tu_api_key

Variables de entorno:
  API_KEY
  BENCH_API_KEY
  BENCH_BASE_URL
  BENCH_CONNECTIONS
  BENCH_DURATION
  BENCH_TIMEOUT
  BENCH_PIPELINING
`);
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

async function preflight(url, headers) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    const durationMs = Date.now() - startedAt;

    console.log(
      `[autocannon] preflight -> ${response.status} en ${durationMs}ms`,
    );

    if (response.status === 401) {
      console.error(
        '[autocannon] La API respondió 401. Revisa x-api-key o carga API_KEY en .env.',
      );
      process.exit(1);
    }

    if (response.status >= 500) {
      console.warn(
        `[autocannon] La API respondió ${response.status} en la prueba previa. El benchmark seguirá, pero el backend ya está fallando.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[autocannon] No se pudo conectar a ${url}. Levanta la API primero. Detalle: ${message}`,
    );
    process.exit(1);
  }
}

async function main() {
  if (hasFlag('--help')) {
    printHelp();
    process.exit(0);
  }

  const target = args.find((value) => !value.startsWith('--'));
  if (!target) {
    printHelp();
    process.exit(1);
  }

  const port = Number(process.env.APP_PORT) || 3000;
  const baseUrl =
    getOption('--base-url', process.env.BENCH_BASE_URL) ||
    `http://127.0.0.1:${port}`;
  const url = buildUrl(target, baseUrl);

  if (!url) {
    console.error(`Target no reconocido: ${target}`);
    printHelp();
    process.exit(1);
  }

  const apiKey =
    getOption('--api-key', process.env.BENCH_API_KEY) || process.env.API_KEY;
  const connections = parsePositiveNumber(
    getOption('--connections', process.env.BENCH_CONNECTIONS),
    20,
  );
  const duration = parsePositiveNumber(
    getOption('--duration', process.env.BENCH_DURATION),
    30,
  );
  const timeout = parsePositiveNumber(
    getOption('--timeout', process.env.BENCH_TIMEOUT),
    60,
  );
  const pipelining = parsePositiveNumber(
    getOption('--pipelining', process.env.BENCH_PIPELINING),
    1,
  );

  const headers = {};
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  console.log(`\n[autocannon] URL: ${url}`);
  console.log(
    `[autocannon] connections=${connections} duration=${duration}s timeout=${timeout}s pipelining=${pipelining}`,
  );
  if (headers['x-api-key']) {
    console.log('[autocannon] usando header x-api-key');
  } else {
    console.log('[autocannon] sin x-api-key');
  }

  await preflight(url, headers);

  const instance = autocannon({
    url,
    connections,
    duration,
    timeout,
    pipelining,
    headers,
  });

  autocannon.track(instance, {
    renderProgressBar: true,
    renderLatencyTable: true,
    renderResultsTable: true,
  });

  instance.on('done', (result) => {
    console.log('\n[autocannon] resumen final');
    console.log(
      JSON.stringify(
        {
          url,
          requestsAverage: result.requests.average,
          requestsMean: result.requests.mean,
          latencyAverage: result.latency.average,
          latencyP99: result.latency.p99,
          throughputAverageBytes: result.throughput.average,
          errors: result.errors,
          timeouts: result.timeouts,
          non2xx: result.non2xx,
        },
        null,
        2,
      ),
    );

    if (
      result.timeouts > 0 &&
      result.requests.average === 0 &&
      result.throughput.average === 0
    ) {
      console.log(
        '[autocannon] Todas o casi todas las requests expiraron antes de responder. Prueba con --timeout=120 y menos concurrencia, por ejemplo --connections=5.',
      );
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

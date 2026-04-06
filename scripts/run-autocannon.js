const autocannon = require('autocannon');

const args = process.argv.slice(2);

const PRESETS = {
  clientes: '/clientes?limite=100&offset=0',
  lotes: '/lotes?limite=100&offset=0',
  cuotasPagadas: '/cuotas-pagadas?limite=100&offset=0&incluirTotal=false',
  cuotasVencidas: '/cuotas-vencidas?limit=100&incluirTotal=false',
};

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

Opciones:
  --base-url=http://127.0.0.1:3000
  --connections=20
  --duration=30
  --pipelining=1
  --api-key=tu_api_key

Variables de entorno:
  API_KEY
  BENCH_API_KEY
  BENCH_BASE_URL
  BENCH_CONNECTIONS
  BENCH_DURATION
  BENCH_PIPELINING
`);
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
    `[autocannon] connections=${connections} duration=${duration}s pipelining=${pipelining}`,
  );
  if (headers['x-api-key']) {
    console.log('[autocannon] usando header x-api-key');
  } else {
    console.log('[autocannon] sin x-api-key');
  }

  const instance = autocannon({
    url,
    connections,
    duration,
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
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

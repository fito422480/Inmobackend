# Inmobackend

Backend en NestJS con adapter Fastify para consultar Oracle con o sin túnel SSH, usando TypeORM y `node-oracledb` en `thick mode`.

## Qué hace

- Puede abrir un túnel SSH hacia el servidor puente o conectarse directo a Oracle.
- Si SSH está habilitado, expone Oracle localmente a través de ese túnel.
- Espera a que la ruta de conexión esté lista antes de crear el pool de TypeORM.
- Si el túnel SSH está habilitado y se cae, intenta reconectar.
- Publica endpoints para consultar vistas Oracle como `clientes`, `lotes`, `cuotas-pagadas`, `cuotas-vencidas` y `cobranzas`.

## Stack

- NestJS 11
- Fastify
- TypeORM 0.3
- Oracle Database
- `oracledb`
- `tunnel-ssh`
- TypeScript
- Header `x-api-key` para proteger endpoints

## Requisitos

- Node.js 20 o superior
- npm
- Acceso SSH al servidor puente, si `SSH_ENABLED=true`
- Credenciales Oracle válidas
- Oracle Instant Client

Importante:
- En Windows, `ORA_CLIENT_LIB_DIR` suele apuntar a la carpeta donde está `oci.dll`.
- En Docker, tenés que montar Oracle Instant Client para Linux `x64/amd64`.

## Configuración

Creá `.env` a partir de `.env.example`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Bash:

```bash
cp .env.example .env
```

Luego completá las credenciales reales.

Si querés conectarte sin SSH, configurá `SSH_ENABLED=false` y apuntá `ORA_HOST`/`ORA_PORT` al host y puerto directos de Oracle.

En producción:

- `APP_HOST=0.0.0.0` permite exponer la app correctamente en Docker o detrás de balanceadores.
- `TRUST_PROXY=true` solo si estás detrás de proxy reverso o CDN.
- `CORS_ORIGINS` acepta una lista separada por comas.
- `CORS_CREDENTIALS=true` solo si realmente usas cookies o sesión.

### Variables de entorno

| Variable | Ejemplo |
| --- | --- |
| `SSH_ENABLED` | `true` |
| `SSH_HOST` | `XXX.XXX.XXX.XXX` |
| `SSH_PORT` | `XX` |
| `SSH_USER` | `usuario_ssh` |
| `SSH_PASSWORD` | `tu_password_ssh` |
| `SSH_LOCAL_PORT` | `15210` |
| `ORA_HOST` | `XXX.XXX.XXX.XXX` |
| `ORA_PORT` | `1521` |
| `ORA_SERVICE` | `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` |
| `ORA_USER` | `XXXXXXXX` |
| `ORA_PASSWORD` | `tu_password_oracle` |
| `ORA_CLIENT_LIB_DIR` | `C:\oracle\instantclient` |
| `ORA_POOL_MIN` | `2` |
| `ORA_POOL_MAX` | `10` |
| `ORA_POOL_INCREMENT` | `1` |
| `APP_PORT` | `3000` |
| `APP_HOST` | `0.0.0.0` |
| `TRUST_PROXY` | `false` |
| `CORS_ORIGINS` | `https://app.midominio.com,https://admin.midominio.com` |
| `CORS_CREDENTIALS` | `false` |
| `API_KEY` | `clave-larga-y-segura` |
| `LOG_SLOW_SQL` | `false` |
| `CLIENTES_CACHE_TTL_MS` | `15000` |
| `CLIENTES_CACHE_MAX_ITEMS` | `200` |
| `LOTES_CACHE_TTL_MS` | `15000` |
| `LOTES_CACHE_MAX_ITEMS` | `200` |
| `CUOTAS_PAGADAS_CACHE_TTL_MS` | `15000` |
| `CUOTAS_PAGADAS_CACHE_MAX_ITEMS` | `200` |
| `CUOTAS_VENCIDAS_CACHE_TTL_MS` | `15000` |
| `CUOTAS_VENCIDAS_CACHE_MAX_ITEMS` | `200` |
| `COBRANZAS_CACHE_TTL_MS` | `15000` |
| `COBRANZAS_CACHE_MAX_ITEMS` | `200` |

## Seguridad

- `GET /` queda público como health-check simple.
- El resto de los endpoints requieren enviar el header `x-api-key`.
- La clave se toma desde `API_KEY` en el `.env`.

Ejemplo:

```bash
curl -H "x-api-key: TU_API_KEY" http://localhost:3000/clientes?limite=10&offset=0
```

## Ejecución local

Instalar dependencias:

```bash
npm install
```

Modo desarrollo:

```bash
npm run start:dev
```

Build y ejecución normal:

```bash
npm run build
npm start
```

## Scripts disponibles

| Script | Descripción |
| --- | --- |
| `npm run build` | Compila el proyecto a `dist/` |
| `npm start` | Ejecuta `dist/main.js` |
| `npm run start:dev` | Ejecuta el watcher con recompilación y reinicio automático |
| `npm run start:prod` | Ejecuta `dist/main.js` |
| `npm run start:tunnel` | Levanta la app y publica con `cloudflared` |
| `npm run bench:clientes` | Ejecuta carga sobre `/clientes` con `autocannon` |
| `npm run bench:lotes` | Ejecuta carga sobre `/lotes` con `autocannon` |
| `npm run bench:cuotas-pagadas` | Ejecuta carga sobre `/cuotas-pagadas` |
| `npm run bench:cuotas-vencidas` | Ejecuta carga sobre `/cuotas-vencidas` |
| `npm run export:cobranzas` | Exporta `/cobranzas` a CSV recorriendo todas las páginas |
| `npm run export:cuotas-vencidas` | Exporta `/cuotas-vencidas` a CSV recorriendo todas las páginas |
| `npm run profile:doctor:clientes` | Perf profiling con `clinic doctor` sobre `/clientes` |
| `npm run profile:doctor:lotes` | Perf profiling con `clinic doctor` sobre `/lotes` |

## Medición de rendimiento

La medición de carga rápida queda preparada con `autocannon` a través de `scripts/run-autocannon.js`.

Ejemplos:

```bash
npm run bench:clientes
npm run bench:lotes
node scripts/run-autocannon.js cuotasVencidas --connections=50 --duration=60
node scripts/run-autocannon.js /clientes?limite=100&offset=0 --connections=20 --duration=30
node scripts/run-autocannon.js cuotasVencidas --connections=5 --duration=30 --timeout=120
```

El runner usa `API_KEY` desde `.env` automáticamente para enviar `x-api-key`.
También permite ajustar el timeout por request con `--timeout` o `BENCH_TIMEOUT`.

Para profiling:

```bash
npm run profile:doctor:clientes
npm run profile:doctor:lotes
```

Nota:
- `clinic.js` es útil para diagnóstico, pero con Node 22 puede fallar o dar resultados inconsistentes.
- Si eso pasa, conviene correr `clinic` con Node 20 LTS o usar `autocannon` junto con el profiler nativo de Node.
- Si necesitas ver el SQL real de un request lento, activa `LOG_SLOW_SQL=true` en `.env` y revisa los logs del backend en `/clientes`, `/lotes`, `/cuotas-pagadas`, `/cuotas-vencidas` y `/cobranzas`.

## Cache y diferidos

Recomendación práctica:

- usar cache para lecturas repetidas con exactamente los mismos filtros, especialmente en `/clientes`, `/lotes`, `/cuotas-pagadas`, `/cuotas-vencidas` y `/cobranzas`;
- usar BullMQ solo para trabajo que no deba ejecutarse dentro del request HTTP, por ejemplo exportaciones grandes, recomputación de reportes, sincronizaciones o procesos batch.

En esta API, cache probablemente te dé más impacto inmediato que BullMQ porque hoy la carga principal parece ser lectura directa desde Oracle.

Mejoras aplicadas en endpoints paginados (`/clientes`, `/lotes`, `/cuotas-pagadas`, `/cuotas-vencidas`, `/cobranzas`):

- `incluirTotal` queda desactivado por defecto para evitar `COUNT(*)` en cada request;
- hay cache TTL corto en memoria para requests repetidas con los mismos filtros;
- las requests idénticas simultáneas comparten la misma consulta en vuelo para evitar trabajo duplicado;
- se registran timings lentos tanto a nivel request como a nivel servicio.

Pool Oracle:

- el pool de TypeORM ahora se configura por `ORA_POOL_MIN`, `ORA_POOL_MAX` y `ORA_POOL_INCREMENT`;
- `GET /test-oracle` reutiliza el mismo pool de TypeORM en lugar de abrir un segundo pool adicional.

## Flujo de arranque

Al iniciar la aplicación:

1. Si `SSH_ENABLED=true`, abre el túnel SSH hacia el servidor configurado.
2. Si `SSH_ENABLED=true`, hace forwarding desde `localhost:<puerto_local>` hacia Oracle.
3. Espera a que la ruta de conexión esté disponible.
4. Inicializa TypeORM y el pool Oracle.
5. Si el túnel SSH está habilitado y falla, intenta reconectar automáticamente.

## Docker

El repo incluye [Dockerfile](d:/apps/inmo/Inmobackend/Dockerfile) y [docker-compose.yml](d:/apps/inmo/Inmobackend/docker-compose.yml).

Antes de levantar Docker:

1. Creá `.env`.
2. Copiá Oracle Instant Client para Linux `x64/amd64` dentro de `docker/oracle/instantclient`.

Levantar:

```bash
docker compose up --build -d
```

Detener:

```bash
docker compose down
```

## Endpoints actuales

### Estado

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/` | Estado simple del backend |
| `GET` | `/test-oracle` | Ejecuta `SELECT SYSDATE AS fecha FROM DUAL` |

Salvo `GET /`, todos los endpoints requieren `x-api-key`.

### Cuotas pagadas

Ruta base:

```text
/cuotas-pagadas
```

Parámetros principales:

- `limite`
- `offset`
- `incluirTotal`
- `numeroContrato`
- `documento`
- `idCliente`
- `sucursal`
- `estadoActualContrato`
- `moneda`
- `fechaDesde`
- `fechaHasta`

Ejemplos:

```http
GET /cuotas-pagadas?limite=100&offset=0
GET /cuotas-pagadas?limite=100&offset=0&incluirTotal=false
GET /cuotas-pagadas?documento=1234567&limite=100&offset=0
```

### Clientes

Ruta base:

```text
/clientes
```

Parámetros principales:

- `limit` o `limite`
- `offset`
- `incluirTotal`
- `idPersona`
- `documento`
- `ruc`
- `nombreCompleto`
- `primerNombre`
- `primerApellido`
- `estado`
- `estadoCivil`
- `nacionalidad`
- `sexo`
- `tipoDocumento`
- `barrio`
- `sucursal`
- `pais`
- `profesion`
- `departamento`
- `distrito`
- `localidad`
- `numeroContrato`
- `estadoContrato`
- `vendedor`
- `condominio`
- `recuperado`
- `refinanciacion`
- `indCliente`
- `indProveedor`
- `indEmpleado`
- `informconf`
- `idLote`
- `idFraccion`
- `mesesAtrasoDesde`
- `mesesAtrasoHasta`
- `fechaIngresoDesde`
- `fechaIngresoHasta`
- `fechaNacimientoDesde`
- `fechaNacimientoHasta`
- `fechaPrimeraVentaDesde`
- `fechaPrimeraVentaHasta`
- `fechaBajaDesde`
- `fechaBajaHasta`

Ejemplos:

```http
GET /clientes?limite=100&offset=0
GET /clientes?documento=1234567&limite=100&offset=0
GET /clientes?numeroContrato=00012345&limite=100&offset=0
GET /clientes?sucursal=CDE&estadoContrato=ACTIVO&limite=100&offset=0
```

### Lotes

Ruta base:

```text
/lotes
```

Parámetros principales:

- `limit` o `limite`
- `offset`
- `incluirTotal`
- `idLote`
- `idFraccion`
- `idManzana`
- `idCliente`
- `numeroContrato`
- `numeroTrato`
- `numeroLote`
- `cliente`
- `docIdentCliente`
- `estado`
- `sucursal`
- `vendedor`
- `fechaContratoDesde`
- `fechaContratoHasta`
- `fechaUltimoPagoDesde`
- `fechaUltimoPagoHasta`
- `fechaVentaDesde`
- `fechaVentaHasta`

Ejemplos:

```http
GET /lotes?limite=100&offset=0
GET /lotes?idLote=1234
GET /lotes?numeroContrato=00012345&limite=50&offset=0
GET /lotes?idFraccion=10&idManzana=4&sucursal=CDE&limite=100&offset=0
GET /lotes?cliente=JUAN%20PEREZ&docIdentCliente=1234567&limite=20&offset=0
```

### Cuotas vencidas

Ruta base:

```text
/cuotas-vencidas
```

Parámetros principales:

- `limit` o `limite`
- `cursor`
- `offset`
- `incluirTotal`
- `numeroContrato`
- `documento`
- `idCliente`
- `sucursal`
- `estado`
- `estadoContrato`
- `estadoCuota`
- `vendedor`
- `mesesMoraDesde`
- `mesesMoraHasta`
- `mesesMoraHastaExclusivo`
- `fechaVencimientoDesde`
- `fechaVencimientoHasta`
- `ultimoPagoDesde`
- `ultimoPagoHasta`

Orden actual:

- `mesesMora DESC`
- `fechaVencimiento ASC`
- `numeroContrato ASC`
- `numeroCuota ASC`

Ejemplos:

```http
GET /cuotas-vencidas?limit=100
GET /cuotas-vencidas?limit=100&cursor=<nextCursor>
GET /cuotas-vencidas?estadoCuota=VENCIDA&fechaVencimientoDesde=2024-01-01&limit=100
GET /cuotas-vencidas?mesesMoraDesde=0&mesesMoraHastaExclusivo=31&limit=100
GET /cuotas-vencidas?mesesMoraDesde=31&mesesMoraHastaExclusivo=91&limit=100
GET /cuotas-vencidas?mesesMoraDesde=91&limit=100
```

`mesesMoraHasta` es inclusivo (`<=`). Si necesitás cortes sin solape, usá `mesesMoraHastaExclusivo` (`<`) y no lo combines con `mesesMoraHasta`.

Respuesta típica con cursor:

```json
{
  "data": [],
  "total": null,
  "limite": 100,
  "offset": null,
  "pagina": null,
  "totalPaginas": null,
  "incluirTotal": false,
  "modoPaginacion": "cursor",
  "cursorActual": null,
  "nextCursor": "eyJmdiI6IjIwMjQtMDEtMDEgMDA6MDA6MDAiLCJuYyI6IjEyMyIsIm5xIjoxfQ",
  "tieneMas": true
}
```

### Cobranzas

Ruta base:

```text
/cobranzas
```

Parámetros principales:

- `limit` o `limite`
- `cursor`
- `offset`
- `incluirTotal`
- `estado`
- `mesesAtrasoDesde`
- `mesesAtrasoHasta`

Orden actual:

- `mesesAtraso DESC`
- `vencimiento ASC`
- `contrato ASC`
- `cuota ASC`

Ejemplos:

```http
GET /cobranzas?limit=100
GET /cobranzas?limit=100&cursor=<nextCursor>
GET /cobranzas?estado=VENCIDO&limit=100
GET /cobranzas?mesesAtrasoDesde=3&mesesAtrasoHasta=12&limit=100
GET /cobranzas?incluirTotal=true&offset=0&limit=100
```

Respuesta típica con cursor:

```json
{
  "data": [],
  "total": null,
  "limite": 100,
  "offset": null,
  "pagina": null,
  "totalPaginas": null,
  "incluirTotal": false,
  "modoPaginacion": "cursor",
  "cursorActual": null,
  "nextCursor": "eyJtYSI6MywidiI6IjIwMjQtMDEtMDEgMDA6MDA6MDAiLCJjIjoiMDAwMTIzNDUiLCJxIjoxfQ",
  "tieneMas": true
}
```

## Paginación y rendimiento

`clientes`, `lotes` y `cuotas-pagadas` soportan paginación por `offset`. `cuotas-vencidas` y `cobranzas` usan `cursor` como mecanismo recomendado y mantienen `offset` solo por compatibilidad.

Recomendaciones:

- usar páginas de `100` a `500` registros,
- evitar `COUNT(*)` cuando no haga falta,
- preferir `incluirTotal=false` en vistas grandes.

En `cuotas-vencidas` y `cobranzas`, `incluirTotal` queda desactivado por defecto para responder más rápido en consultas grandes.

## Desarrollo de nuevos módulos

Para agregar un nuevo módulo Oracle:

1. Crear la entidad o vista en `src/<modulo>/<modulo>.entity.ts`.
2. Crear `service`, `controller` y `module`.
3. Registrar la entidad con `TypeOrmModule.forFeature(...)`.
4. Importar el módulo en `AppModule`.

## Troubleshooting

### Error al cargar Oracle Client

Revisar:

- que `ORA_CLIENT_LIB_DIR` apunte a la carpeta correcta,
- que el cliente Oracle corresponda al sistema operativo,
- que en Docker hayas montado la versión Linux y no la de Windows.

### No conecta a Oracle

Revisar:

- credenciales SSH,
- acceso desde el servidor SSH al host Oracle,
- credenciales Oracle,
- `ORA_SERVICE`,
- puertos configurados.

### El puerto local está ocupado

El servicio intenta usar automáticamente el siguiente puerto libre.

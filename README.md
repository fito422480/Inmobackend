# Inmobackend

Backend en NestJS con adapter Fastify para consultar Oracle con o sin túnel SSH, usando TypeORM y `node-oracledb` en `thick mode`.

## Qué hace

- Puede abrir un túnel SSH hacia el servidor puente o conectarse directo a Oracle.
- Si SSH está habilitado, expone Oracle localmente a través de ese túnel.
- Espera a que la ruta de conexión esté lista antes de crear el pool de TypeORM.
- Si el túnel SSH está habilitado y se cae, intenta reconectar.
- Publica endpoints para consultar vistas Oracle como `clientes`, `lotes`, `cuotas-pagadas`, `detalle-cuotas`, `cuotas-general`, `cuotas-vencidas`, `cobranzas`, `cobranzas-v2`, `estado-cuentas`, `total-pagado`, `total-pagado-mes` y `pagos-por-franja`.

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
| `COBRANZAS_V2_CACHE_TTL_MS` | `15000` |
| `COBRANZAS_V2_CACHE_MAX_ITEMS` | `200` |
| `DETALLE_CUOTAS_MAX_LIMIT` | `5000` |
| `DETALLE_CUOTAS_CACHE_TTL_MS` | `15000` |
| `DETALLE_CUOTAS_CACHE_MAX_ITEMS` | `200` |
| `CUOTAS_GENERAL_MAX_LIMIT` | `5000` |
| `CUOTAS_GENERAL_CACHE_TTL_MS` | `15000` |
| `CUOTAS_GENERAL_CACHE_MAX_ITEMS` | `200` |
| `ESTADO_CUENTAS_MAX_LIMIT` | `5000` |
| `ESTADO_CUENTAS_CACHE_TTL_MS` | `15000` |
| `ESTADO_CUENTAS_CACHE_MAX_ITEMS` | `200` |
| `TOTAL_PAGADO_CACHE_TTL_MS` | `15000` |
| `TOTAL_PAGADO_CACHE_MAX_ITEMS` | `200` |
| `TOTAL_PAGADO_MES_CACHE_TTL_MS` | `15000` |
| `TOTAL_PAGADO_MES_CACHE_MAX_ITEMS` | `200` |
| `PAGOS_POR_FRANJA_MAX_LIMIT` | `5000` |
| `PAGOS_POR_FRANJA_CACHE_TTL_MS` | `15000` |
| `PAGOS_POR_FRANJA_CACHE_MAX_ITEMS` | `200` |

Las variables de cache y `*_MAX_LIMIT` son opcionales. Si no las definís, cada servicio usa sus valores por defecto.

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

Ese paso instala tambien `cloudflared` localmente, asi que `npm run start:tunnel`
no requiere una instalacion global adicional.

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
| `npm run start:tunnel` | Levanta la app y publica con el `cloudflared` local del proyecto |
| `npm run bench:clientes` | Ejecuta carga sobre `/clientes` con `autocannon` |
| `npm run bench:lotes` | Ejecuta carga sobre `/lotes` con `autocannon` |
| `npm run bench:cuotas-pagadas` | Ejecuta carga sobre `/cuotas-pagadas` |
| `npm run bench:cuotas-vencidas` | Ejecuta carga sobre `/cuotas-vencidas` |
| `npm run bench:estado-cuentas` | Ejecuta carga sobre `/estado-cuentas` |
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
node scripts/run-autocannon.js estadoCuentas --connections=20 --duration=30
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
- Si necesitas ver el SQL real de un request lento, activa `LOG_SLOW_SQL=true` en `.env` y revisa los logs del backend en `/clientes`, `/lotes`, `/cuotas-pagadas`, `/detalle-cuotas`, `/cuotas-general`, `/cuotas-vencidas`, `/cobranzas`, `/cobranzas-v2`, `/estado-cuentas`, `/total-pagado`, `/total-pagado-mes` y `/pagos-por-franja`.

### `GET /estado-cuentas`

Devuelve clientes con contratos en atraso de 2 meses o mas, estado `Activo` o `Bloqueado`, y cuotas cuyo vencimiento tiene al menos un mes.

Filtros principales:

- `documento` o `numeroDocumento`: filtra por `DOCUMENTO` exacto.
- `contrato` o `numeroContrato`: filtra por `CONTRATO` exacto.
- `limit` o `limite`: tamano de pagina, default `100`.
- `cursor`: siguiente pagina por cursor.
- `offset`: paginacion tradicional.
- `incluirTotal=true`: incluye `COUNT(*)`; por defecto queda apagado para responder mas rapido.

Ejemplos:

```bash
curl -H "x-api-key: TU_API_KEY" "http://localhost:3000/estado-cuentas?documento=1234567"
curl -H "x-api-key: TU_API_KEY" "http://localhost:3000/estado-cuentas?contrato=ABC123&limit=100"
curl -H "x-api-key: TU_API_KEY" "http://localhost:3000/estado-cuentas?documento=1234567&contrato=ABC123"
```

## Cache y diferidos

Recomendación práctica:

- usar cache para lecturas repetidas con exactamente los mismos filtros, especialmente en `/clientes`, `/lotes`, `/cuotas-pagadas`, `/detalle-cuotas`, `/cuotas-general`, `/cuotas-vencidas`, `/cobranzas`, `/cobranzas-v2`, `/estado-cuentas`, `/total-pagado`, `/total-pagado-mes` y `/pagos-por-franja`;
- usar BullMQ solo para trabajo que no deba ejecutarse dentro del request HTTP, por ejemplo exportaciones grandes, recomputación de reportes, sincronizaciones o procesos batch.

En esta API, cache probablemente te dé más impacto inmediato que BullMQ porque hoy la carga principal parece ser lectura directa desde Oracle.

Mejoras aplicadas en endpoints paginados (`/clientes`, `/lotes`, `/cuotas-pagadas`, `/detalle-cuotas`, `/cuotas-general`, `/cuotas-vencidas`, `/cobranzas`, `/cobranzas-v2`, `/estado-cuentas`, `/total-pagado`, `/total-pagado-mes`, `/pagos-por-franja`):

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

Montos en la respuesta:

- `montoCuota`, `interesCobrado`, `descuentoInteres`, `cuotaCobrada` y `notaCred` se devuelven como enteros.
- El redondeo aplicado es hacia arriba.

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

### Total pagado

Ruta base:

```text
/total-pagado
```

Qué devuelve:

- resumen diario agrupado por `TRUNC(FECHA_PAGO)`;
- columnas `fecha`, `mes`, `dia`, `totalPagado`, `totalPagadoReal`, `notaCredito` y `totalInteres`;
- por defecto aplica `NUMERO_CUOTA > 1`, equivalente a la query base del reporte.

Parámetros principales:

- `limit` o `limite`
- `offset`
- `incluirTotal`
- `fechaDesde`
- `fechaHasta`
- `numeroCuotaMinima`

Ejemplos:

```http
GET /total-pagado?fechaDesde=2026-05-01
GET /total-pagado?fechaDesde=2026-05-01&fechaHasta=2026-05-31
GET /total-pagado?fechaDesde=2026-05-01&numeroCuotaMinima=1&incluirTotal=true
```

### Total pagado por mes

Ruta base:

```text
/total-pagado-mes
```

Qué devuelve:

- resumen mensual agrupado por `EXTRACT(YEAR FROM FECHA_PAGO)` y `EXTRACT(MONTH FROM FECHA_PAGO)`;
- columnas `anio`, `mes`, `totalPagado`, `totalPagadoReal`, `notaCredito` y `totalInteres`;
- por defecto aplica `NUMERO_CUOTA > 1`, equivalente a la query base del reporte.

Parámetros principales:

- `limit` o `limite`
- `offset`
- `incluirTotal`
- `fechaDesde`
- `fechaHasta`
- `numeroCuotaMinima`

Ejemplos:

```http
GET /total-pagado-mes?fechaDesde=2026-01-01
GET /total-pagado-mes?fechaDesde=2026-01-01&fechaHasta=2026-05-30
GET /total-pagado-mes?fechaDesde=2026-01-01&fechaHasta=2026-05-30&numeroCuotaMinima=1&incluirTotal=true
```

Para replicar exactamente `FECHA_PAGO >= DATE '2026-01-01' AND FECHA_PAGO < DATE '2026-05-31'`, usa `fechaDesde=2026-01-01&fechaHasta=2026-05-30`, porque el endpoint interpreta `fechaHasta` como inclusiva.

### Pagos por franja

Ruta base:

```text
/pagos-por-franja
```

Que devuelve:

- resumen por `MESES_MORA` y `TRUNC(FECHA_PAGO)`;
- columnas `mesesMora`, `fecha`, `mes`, `dia`, `totalPagado`, `totalPagadoReal`, `notaCredito` y `totalInteres`;
- por defecto aplica `NUMERO_CUOTA > 1`, equivalente a la query base del reporte.

Parametros principales:

- `limit` o `limite`
- `offset`
- `incluirTotal`
- `fechaDesde`
- `fechaHasta`
- `numeroCuotaMinima`
- `mesesMora`
- `mesesMoraDesde`
- `mesesMoraHasta`

Ejemplos:

```http
GET /pagos-por-franja?fechaDesde=2026-06-01
GET /pagos-por-franja?fechaDesde=2026-06-01&fechaHasta=2026-06-30
GET /pagos-por-franja?fechaDesde=2026-06-01&mesesMoraDesde=1&mesesMoraHasta=6&incluirTotal=true
```

### Detalle cuotas

Ruta base:

```text
/detalle-cuotas
```

Parámetros principales:

- `limit` o `limite`
- `offset`
- `incluirTotal`
- `numeroContrato`
- `numeroCuota`
- `numeroCuotaDesde`
- `numeroCuotaHasta`
- `fechaVencimientoDesde`
- `fechaVencimientoHasta`

Ejemplos:

```http
GET /detalle-cuotas?numeroContrato=12345
GET /detalle-cuotas?numeroContrato=12345&limit=50&offset=0
GET /detalle-cuotas?fechaVencimientoDesde=2024-01-01&fechaVencimientoHasta=2024-12-31
```

Campos relevantes en la respuesta:

- `moraCuota` ya viene incluida junto con `numeroContrato`, `fechaVencimiento`, `fechaPago`, `numeroCuota`, `montoCuota` y `cuotaCobrada`.

### Cuotas general

Ruta base:

```text
/cuotas-general
```

Parámetros principales:

- `limit` o `limite`
- `offset`
- `incluirTotal`
- `numeroContrato` o `contrato`
- `documento`
- `idCliente`
- `idFraccion`
- `idManzana`
- `idLote`
- `sucursal`
- `numeroCuota`, `numeroCuotaDesde`, `numeroCuotaHasta`
- `estadoActualContrato` o `estadoContrato`
- `montoCuotaDesde`, `montoCuotaHasta`
- `moraCuotaDesde`, `moraCuotaHasta`
- `fechaVencimientoDesde`, `fechaVencimientoHasta`
- `mesesMora`, `mesesMoraDesde`, `mesesMoraHasta`
- `fechaPagoDesde`, `fechaPagoHasta`
- `fecContratoDesde`, `fecContratoHasta`
- `fecTratoDesde`, `fecTratoHasta`
- `saldoVencidoDesde`, `saldoVencidoHasta`
- `estadoCuota`
- `vendedor`

Ejemplos:

```http
GET /cuotas-general?numeroContrato=A3779
GET /cuotas-general?documento=1234567&estadoCuota=VENCIDA&incluirTotal=true
GET /cuotas-general?moraCuotaDesde=100000&fecContratoDesde=2024-01-01&fecContratoHasta=2024-12-31
```

Notas:

- `cuotas-general` concentra filtros contractuales, comerciales y de mora en un solo endpoint de consulta.
- `limit` queda topado por `CUOTAS_GENERAL_MAX_LIMIT`.

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
- `mesesAtraso`
- `mesesAtrasoDesde`
- `mesesAtrasoHasta`

Orden actual:

- `mesesAtraso DESC`
- `vencimiento ASC`
- `contrato ASC`
- `cuota ASC`

Reglas de negocio aplicadas por el servicio:

- solo devuelve registros con `estado` dentro de `Activo` o `Bloqueado`;
- solo considera contratos con `fecContrato < TRUNC(SYSDATE, 'MM')`;
- si no enviás `mesesAtraso`, `mesesAtrasoDesde` ni `mesesAtrasoHasta`, el filtro por defecto es `mesesAtraso=0`.

Ejemplos:

```http
GET /cobranzas?limit=100
GET /cobranzas?limit=100&cursor=<nextCursor>
GET /cobranzas?estado=Activo&limit=100
GET /cobranzas?mesesAtraso=0&limit=100
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

### Cobranzas v2

Ruta base:

```text
/cobranzas-v2
```

Parámetros principales:

- `limit` o `limite`
- `cursor`
- `offset`
- `incluirTotal`
- `contrato`
- `cobrador`
- `empresa`
- `estado`
- `mesesAtraso`
- `mesesAtrasoDesde`
- `mesesAtrasoHasta`

Ejemplos:

```http
GET /cobranzas-v2?limit=100
GET /cobranzas-v2?cobrador=JUAN%20PEREZ&limit=100
GET /cobranzas-v2?empresa=INMO&mesesAtrasoDesde=1&mesesAtrasoHasta=6
```

Notas:

- `cobranzas-v2` agrega filtros puntuales por `cobrador` y `empresa`.
- mantiene el mismo esquema de respuesta paginada con `cursor` recomendado para volúmenes grandes.

## Paginación y rendimiento

`clientes`, `lotes`, `cuotas-pagadas`, `total-pagado`, `total-pagado-mes`, `pagos-por-franja`, `detalle-cuotas` y `cuotas-general` soportan paginación por `offset`. `estado-cuentas`, `cuotas-vencidas`, `cobranzas` y `cobranzas-v2` usan `cursor` como mecanismo recomendado y mantienen `offset` solo por compatibilidad.

Recomendaciones:

- usar páginas de `100` a `500` registros,
- evitar `COUNT(*)` cuando no haga falta,
- preferir `incluirTotal=false` en vistas grandes.

En `estado-cuentas`, `cuotas-vencidas`, `cobranzas`, `cobranzas-v2`, `detalle-cuotas`, `cuotas-general`, `total-pagado`, `total-pagado-mes` y `pagos-por-franja`, `incluirTotal` queda desactivado por defecto para responder mas rapido en consultas grandes.

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

# Inmobackend

Backend en NestJS para consultar Oracle con o sin túnel SSH, usando TypeORM y `node-oracledb` en `thick mode`.

## Qué hace

- Puede abrir un túnel SSH hacia el servidor puente o conectarse directo a Oracle.
- Si SSH está habilitado, expone Oracle localmente a través de ese túnel.
- Espera a que la ruta de conexión esté lista antes de crear el pool de TypeORM.
- Si el túnel SSH está habilitado y se cae, intenta reconectar.
- Publica endpoints para consultar vistas Oracle como `cuotas-pagadas` y `cuotas-vencidas`.

## Stack

- NestJS 11
- TypeORM 0.3
- Oracle Database
- `oracledb`
- `tunnel-ssh`
- TypeScript

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
| `APP_PORT` | `3000` |

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

## Paginación y rendimiento

`cuotas-pagadas` soporta paginación por `offset`. `cuotas-vencidas` ahora usa `cursor` como mecanismo recomendado y mantiene `offset` solo por compatibilidad.

Recomendaciones:

- usar páginas de `100` a `500` registros,
- evitar `COUNT(*)` cuando no haga falta,
- preferir `incluirTotal=false` en vistas grandes.

En `cuotas-vencidas`, `incluirTotal` queda desactivado por defecto para responder más rápido en consultas grandes.

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

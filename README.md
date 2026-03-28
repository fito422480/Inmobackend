# Inmobackend

Backend en NestJS para consultar Oracle a través de un túnel SSH, con acceso vía TypeORM y soporte para `node-oracledb` en `thick mode`.

## Qué hace este proyecto

- Abre un túnel SSH hacia el servidor intermedio.
- Expone la base Oracle localmente a través de ese túnel.
- Inicializa TypeORM una vez que el túnel está listo.
- Mantiene el túnel activo e intenta reconectar si se cae.
- Publica endpoints HTTP para consultar vistas Oracle como `cuotas-pagadas` y `cuotas-vencidas`.

## Stack

- NestJS 11
- TypeORM 0.3
- Oracle Database con `oracledb`
- `tunnel-ssh`
- TypeScript

## Estructura general

```text
Cliente HTTP
  -> NestJS
  -> TunnelService
  -> localhost:<puerto_local_ssh>
  -> Oracle DB
```

## Requisitos

- Node.js 20 o superior
- npm
- Acceso SSH al servidor puente
- Credenciales Oracle válidas
- Oracle Instant Client

Importante:
- En ejecución local sobre Windows, `ORA_CLIENT_LIB_DIR` suele apuntar a la carpeta donde está `oci.dll`.
- En Docker, hay que montar Oracle Instant Client para Linux `x64/amd64`.

## Configuración

1. Crear tu archivo `.env` a partir de `.env.example`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Bash:

```bash
cp .env.example .env
```

2. Editar `.env` con las credenciales reales.

### Variables de entorno

| Variable | Descripción |
| --- | --- |
| `SSH_HOST` | Host del servidor SSH puente |
| `SSH_PORT` | Puerto SSH |
| `SSH_USER` | Usuario SSH |
| `SSH_PASSWORD` | Password SSH |
| `SSH_LOCAL_PORT` | Puerto local preferido para el túnel; si está ocupado, busca otro |
| `ORA_HOST` | Host Oracle accesible desde el servidor SSH |
| `ORA_PORT` | Puerto Oracle |
| `ORA_SERVICE` | Service name Oracle |
| `ORA_USER` | Usuario Oracle |
| `ORA_PASSWORD` | Password Oracle |
| `ORA_CLIENT_LIB_DIR` | Ruta del Oracle Instant Client; opcional si ya está en `PATH` |
| `APP_PORT` | Puerto HTTP del backend |

## Ejecución local

### Instalar dependencias

```bash
npm install
```

### Modo desarrollo

```bash
npm run start:dev
```

Este comando usa `dev-runner.js`, que:

- compila el proyecto,
- observa cambios en `src/`, `tsconfig.json`, `nest-cli.json` y `.env`,
- reinicia automáticamente el backend al detectar cambios.

### Build y ejecución normal

```bash
npm run build
npm start
```

## Docker

Se incluye un `Dockerfile` multi-stage y un `docker-compose.yml`.

### Antes de levantar Docker

1. Crear `.env`.
2. Copiar Oracle Instant Client para Linux `x64/amd64` dentro de:

```text
docker/oracle/instantclient
```

Ese directorio se monta dentro del contenedor en:

```text
/opt/oracle/instantclient
```

### Levantar con Docker Compose

```bash
docker compose up --build -d
```

### Detener

```bash
docker compose down
```

Notas:

- El contenedor expone `APP_PORT`.
- `docker-compose.yml` carga variables desde `.env`.
- El proyecto sigue necesitando acceso real al servidor SSH y a Oracle.

## Scripts disponibles

| Script | Descripción |
| --- | --- |
| `npm run build` | Compila NestJS a `dist/` |
| `npm start` | Ejecuta `dist/main.js` |
| `npm run start:dev` | Desarrollo con recompilación y reinicio automático |
| `npm run start:prod` | Ejecuta `dist/main.js` |
| `npm run start:tunnel` | Levanta la app y además publica con `cloudflared` |

## Flujo de arranque

Al iniciar la aplicación:

1. `TunnelService` intenta abrir el túnel SSH.
2. Si el puerto local preferido está ocupado, busca el siguiente libre.
3. `DatabaseModule` espera a que el túnel esté listo.
4. TypeORM crea el pool Oracle usando el puerto local del túnel.
5. Si el túnel falla, el servicio intenta reconectar.

## Endpoints actuales

### Estado general

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
- `fechaVencimientoDesde`
- `fechaVencimientoHasta`
- `ultimoPagoDesde`
- `ultimoPagoHasta`

Ejemplos:

```http
GET /cuotas-vencidas?limit=100&offset=0
GET /cuotas-vencidas?limit=100&offset=100
GET /cuotas-vencidas?estadoCuota=VENCIDA&fechaVencimientoDesde=2024-01-01&limit=100&offset=0
```

## Paginación y rendimiento

`cuotas-pagadas` y `cuotas-vencidas` soportan paginación por `offset`.

Recomendaciones:

- usar páginas chicas o medianas, por ejemplo `100` o `500`,
- evitar `COUNT(*)` cuando no haga falta,
- preferir `incluirTotal=false` para vistas muy grandes.

En `cuotas-vencidas`, `incluirTotal` queda desactivado por defecto para responder más rápido sobre volúmenes altos.

## Desarrollo de nuevos módulos

Para agregar un nuevo módulo Oracle:

1. Crear una entidad o vista en `src/<modulo>/<modulo>.entity.ts`.
2. Crear `service`, `controller` y `module`.
3. Registrar la entidad con `TypeOrmModule.forFeature(...)`.
4. Importar el módulo en `AppModule`.

Ejemplo base:

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([TuEntity])],
  providers: [TuService],
  controllers: [TuController],
})
export class TuModule {}
```

## Troubleshooting

### Error al cargar Oracle Client

Revisar:

- que `ORA_CLIENT_LIB_DIR` apunte a la carpeta correcta,
- que el cliente Oracle corresponda al sistema operativo,
- que en Docker hayas montado la versión Linux y no la de Windows.

### El backend no conecta a Oracle

Revisar:

- credenciales SSH,
- acceso desde el servidor SSH al host Oracle,
- credenciales Oracle,
- `ORA_SERVICE`,
- puertos configurados.

### El puerto local del túnel está ocupado

No hace falta cambiar código: el servicio intenta usar el siguiente puerto libre automáticamente.

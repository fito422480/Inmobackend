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

## Variables de entorno (.env)

| Variable     | Valor                                          |
|--------------|------------------------------------------------|
| SSH_HOST     | 100.123.107.110                                |
| SSH_PORT     | 22                                             |
| SSH_USER     | sistemas                                       |
| SSH_PASSWORD | tu_password_rdp                                |
| ORA_HOST     | 129.151.122.103                                |
| ORA_PORT     | 1521                                           |
| ORA_SERVICE  | INMO.srpubchile.redprincipalchi.oraclevcn.com |
| ORA_USER     | inmo_dbu                                       |
| ORA_PASSWORD | tu_password_oracle                             |
| ORA_CLIENT_LIB_DIR | Opcional. Ruta a Oracle Instant Client si no está en PATH |
| APP_PORT     | 3000                                           |

## Oracle Thick Mode

Esta base Oracle exige Native Network Encryption / Data Integrity, así que `node-oracledb`
debe correr en `thick mode`.

- Si Oracle Instant Client ya está en el `PATH`, el backend lo usa automáticamente.
- Si no está en el `PATH`, definí `ORA_CLIENT_LIB_DIR` con la carpeta donde está `oci.dll`.

## Lo que hace al iniciar

1. Abre túnel SSH → svr-01 (100.123.107.110)
2. Forwarding localhost:15210 → Oracle (129.151.122.103:1521)
3. TypeORM crea el pool de conexiones automáticamente
4. Si el túnel se cae, se reconecta solo

## Crear un nuevo módulo con tu tabla Oracle

### 1 — Creá la entidad (mapeá tu tabla)

```typescript
// src/tu-modulo/tu.entity.ts
@Entity({ name: 'NOMBRE_TABLA_ORACLE' })
export class TuEntity {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'COLUMNA' })
  columna: string;
}
```

### 2 — Creá el servicio

```typescript
@Injectable()
export class TuService {
  constructor(
    @InjectRepository(TuEntity)
    private repo: Repository<TuEntity>,
  ) {}

  findAll() { return this.repo.find(); }
  findOne(id: number) { return this.repo.findOne({ where: { id } }); }
  create(data: Partial<TuEntity>) { return this.repo.save(this.repo.create(data)); }
  update(id: number, data: Partial<TuEntity>) { return this.repo.update(id, data); }
}
```

### 3 — Registrá en el módulo

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

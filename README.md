# Oracle Backend — NestJS + TypeORM + SSH Tunnel

## Setup

```bash
npm install
cp .env.example .env
# Editá .env con tus credenciales
npm run start:dev
```

## Variables de entorno (.env)

| Variable     | Valor                                          |
|--------------|------------------------------------------------|
| SSH_HOST     | xxx.xxx.xxx.xxx                                |
| SSH_PORT     | 22                                             |
| SSH_USER     | sistemas                                       |
| SSH_PASSWORD | tu_password_rdp                                |
| ORA_HOST     | xxx.xxx.xxx.xxx                                |
| ORA_PORT     | 1521                                           |
| ORA_SERVICE  | xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx |
| ORA_USER     | xxxxxxxx                                       |
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

### 4 — Agregá en AppModule

```typescript
imports: [TunnelModule, DatabaseModule, TuModule]
```

## Endpoints de ejemplo (EjemploModule)

| Método | Ruta                      | Descripción         |
|--------|---------------------------|---------------------|
| GET    | /ejemplo                  | Listar todos        |
| GET    | /ejemplo/:id              | Obtener por ID      |
| GET    | /ejemplo/buscar?nombre=x  | Buscar por nombre   |
| POST   | /ejemplo                  | Crear               |
| PUT    | /ejemplo/:id              | Actualizar          |
| DELETE | /ejemplo/:id              | Eliminar (soft)     |

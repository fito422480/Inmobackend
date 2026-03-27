import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TunnelService } from "../tunnel/tunnel.service";
import * as oracledb from "oracledb";

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: oracledb.Pool | null = null;

  constructor(
    private config: ConfigService,
    private tunnel: TunnelService,
  ) {}

  async onModuleInit() {
    // Esperar que el túnel esté listo antes de crear el pool
    await this.tunnel.waitUntilReady();
    await this.createPool();
  }

  private async createPool(): Promise<void> {
    try {
      this.enableThickMode();

      const localPort = this.tunnel.getLocalPort();

      this.logger.log(` Conectando a Oracle vía localhost:${localPort}`);

      this.pool = await oracledb.createPool({
        user: this.config.get("ORA_USER"),
        password: this.config.get("ORA_PASSWORD"),
        connectString: `localhost:${localPort}/${this.config.get("ORA_SERVICE")}`,
        poolMin: 2,
        poolMax: 10,
        poolIncrement: 1,
      });

      // Test de conexión
      const conn = await this.pool.getConnection();
      const result = await conn.execute("SELECT 1 FROM DUAL");
      await conn.close();

      this.logger.log("Conexión a Oracle establecida correctamente");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error conectando a Oracle: ${message}`);
      this.logger.log("Reintentando en 10 segundos...");
      setTimeout(() => this.createPool(), 10000);
    }
  }

  private enableThickMode(): void {
    if (!oracledb.thin) {
      return;
    }

    const libDir = this.config.get<string>("ORA_CLIENT_LIB_DIR");

    if (libDir) {
      oracledb.initOracleClient({ libDir });
      this.logger.log(`Oracle client inicializado en modo thick (${libDir})`);
      return;
    }

    oracledb.initOracleClient();
    this.logger.log(
      "Oracle client inicializado en modo thick usando Oracle Instant Client del PATH",
    );
  }

  // ─── Método principal para ejecutar queries ───────────────────────────────
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.pool) throw new Error("Pool de Oracle no inicializado");

    const conn = await this.pool.getConnection();
    try {
      const result = await conn.execute(sql, params, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchArraySize: 100,
      });
      return (result.rows as T[]) || [];
    } finally {
      await conn.close();
    }
  }

  // ─── Ejecutar INSERT/UPDATE/DELETE ────────────────────────────────────────
  async execute(
    sql: string,
    params: any[] = [],
  ): Promise<oracledb.Result<unknown>> {
    if (!this.pool) throw new Error("Pool de Oracle no inicializado");

    const conn = await this.pool.getConnection();
    try {
      const result = await conn.execute(sql, params, { autoCommit: true });
      return result;
    } finally {
      await conn.close();
    }
  }
}

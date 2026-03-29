import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTunnel } from "tunnel-ssh";
import * as net from "net";

@Injectable()
export class TunnelService implements OnModuleDestroy {
  private readonly logger = new Logger(TunnelService.name);
  private tunnelServer: net.Server | null = null;
  private localPort: number = 15210;
  private readonly sshEnabled: boolean;
  private ready = false;
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void>;

  constructor(private config: ConfigService) {
    this.sshEnabled = this.parseBoolean(
      this.config.get<string>("SSH_ENABLED"),
      true,
    );
    this.localPort = parseInt(this.config.get("SSH_LOCAL_PORT") || "15210");
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    if (this.sshEnabled) {
      // Abrir el túnel al instanciar el servicio
      this.openTunnel();
      return;
    }

    this.ready = true;
    this.resolveReady();
    this.logger.log(
      `SSH deshabilitado. Conexion directa a Oracle -> ${this.getDatabaseHost()}:${this.getDatabasePort()}`,
    );
  }

  onModuleDestroy() {
    this.closeTunnel();
  }

  getLocalPort(): number {
    return this.localPort;
  }

  isEnabled(): boolean {
    return this.sshEnabled;
  }

  getDatabaseHost(): string {
    if (this.sshEnabled) {
      return "localhost";
    }

    return this.config.get("ORA_HOST") || "localhost";
  }

  getDatabasePort(): number {
    if (this.sshEnabled) {
      return this.localPort;
    }

    return parseInt(this.config.get("ORA_PORT") || "1521");
  }

  // TypeORM llama a esto antes de conectar
  waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  private async openTunnel(): Promise<void> {
    if (!this.sshEnabled) {
      this.ready = true;
      this.resolveReady();
      return;
    }

    const sshConfig = {
      host: this.config.get("SSH_HOST"),
      port: parseInt(this.config.get("SSH_PORT") || "22"),
      username: this.config.get("SSH_USER"),
      password: this.config.get("SSH_PASSWORD"),
      keepAlive: true,
      readyTimeout: 20000,
    };

    const tunnelOptions = {
      autoClose: false,
      reconnectOnError: false,
    };

    const serverOptions = {
      host: "127.0.0.1",
      port: this.localPort,
    };

    const forwardOptions = {
      dstAddr: this.config.get("ORA_HOST"),
      dstPort: parseInt(this.config.get("ORA_PORT") || "1521"),
    };

    try {
      this.logger.log(
        `🔌 Abriendo túnel SSH → ${sshConfig.host}:${sshConfig.port}`,
      );

      const [server] = await createTunnel(
        tunnelOptions,
        serverOptions,
        sshConfig,
        forwardOptions,
      );

      this.tunnelServer = server;
      const address = server.address();
      if (address && typeof address !== "string") {
        this.localPort = address.port;
      }
      this.ready = true;

      // Resolver la promesa para desbloquear TypeORM
      this.resolveReady();

      this.logger.log(
        `Túnel SSH activo → localhost:${this.localPort} → ${forwardOptions.dstAddr}:${forwardOptions.dstPort}`,
      );

      server.on("error", (err) => {
        this.logger.error(`Error en el túnel: ${err.message}`);
        this.reconnect();
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("EADDRINUSE")) {
        this.localPort = await this.findAvailablePort(this.localPort + 1);
        this.logger.warn(
          `Puerto local ocupado. Reintentando túnel SSH en localhost:${this.localPort}...`,
        );
        setTimeout(() => this.openTunnel(), 1000);
        return;
      }

      this.logger.error(`Error abriendo túnel SSH: ${message}`);
      this.logger.log("Reintentando en 10 segundos...");
      setTimeout(() => this.openTunnel(), 10000);
    }
  }

  private closeTunnel(): void {
    if (this.tunnelServer) {
      this.tunnelServer.close();
      this.tunnelServer = null;
      this.ready = false;
      this.logger.log("🔴 Túnel SSH cerrado");
    }
  }

  private async reconnect(): Promise<void> {
    if (!this.sshEnabled) {
      return;
    }

    this.logger.log("Reconectando túnel SSH...");
    this.closeTunnel();
    // Resetear la promesa de ready
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    await new Promise((r) => setTimeout(r, 5000));
    await this.openTunnel();
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    let port = startPort;

    while (!(await this.isPortFree(port))) {
      port += 1;
    }

    return port;
  }

  private isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const tester = net.createServer();

      tester.once("error", () => resolve(false));
      tester.once("listening", () => {
        tester.close(() => resolve(true));
      });

      tester.listen(port, "127.0.0.1");
    });
  }

  private resolveReady(): void {
    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = null;
    }
  }

  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) {
      return defaultValue;
    }

    const normalizedValue = value.trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(normalizedValue)) {
      return true;
    }

    if (["0", "false", "no", "off"].includes(normalizedValue)) {
      return false;
    }

    return defaultValue;
  }
}

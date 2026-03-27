import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTunnel } from "tunnel-ssh";
import * as net from "net";

@Injectable()
export class TunnelService implements OnModuleDestroy {
  private readonly logger = new Logger(TunnelService.name);
  private tunnelServer: net.Server | null = null;
  private localPort: number = 15210;
  private ready = false;
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void>;

  constructor(private config: ConfigService) {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    // Abrir el túnel al instanciar el servicio
    this.openTunnel();
  }

  onModuleDestroy() {
    this.closeTunnel();
  }

  getLocalPort(): number {
    return this.localPort;
  }

  // TypeORM llama a esto antes de conectar
  waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  private async openTunnel(): Promise<void> {
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

    const serverOptions = { port: this.localPort };

    const forwardOptions = {
      srcAddr: "127.0.0.1",
      srcPort: this.localPort,
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
      this.ready = true;

      // Resolver la promesa para desbloquear TypeORM
      if (this.readyResolve) {
        this.readyResolve();
        this.readyResolve = null;
      }

      this.logger.log(
        `Túnel SSH activo → localhost:${this.localPort} → ${forwardOptions.dstAddr}:${forwardOptions.dstPort}`,
      );

      server.on("error", (err) => {
        this.logger.error(`Error en el túnel: ${err.message}`);
        this.reconnect();
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
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
    this.logger.log("Reconectando túnel SSH...");
    this.closeTunnel();
    // Resetear la promesa de ready
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    await new Promise((r) => setTimeout(r, 5000));
    await this.openTunnel();
  }
}

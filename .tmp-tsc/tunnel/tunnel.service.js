"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TunnelService = void 0;
const common_1 = require("@nestjs/common");
const tunnel_ssh_1 = require("tunnel-ssh");
let TunnelService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var TunnelService = _classThis = class {
        constructor(config) {
            this.config = config;
            this.logger = new common_1.Logger(TunnelService.name);
            this.tunnelServer = null;
            this.localPort = 15210;
            this.ready = false;
            this.readyResolve = null;
            this.readyPromise = new Promise((resolve) => {
                this.readyResolve = resolve;
            });
            // Abrir el túnel al instanciar el servicio
            this.openTunnel();
        }
        onModuleDestroy() {
            this.closeTunnel();
        }
        getLocalPort() {
            return this.localPort;
        }
        // TypeORM llama a esto antes de conectar
        waitUntilReady() {
            return this.readyPromise;
        }
        async openTunnel() {
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
                this.logger.log(`🔌 Abriendo túnel SSH → ${sshConfig.host}:${sshConfig.port}`);
                const [server] = await (0, tunnel_ssh_1.createTunnel)(tunnelOptions, serverOptions, sshConfig, forwardOptions);
                this.tunnelServer = server;
                this.ready = true;
                // Resolver la promesa para desbloquear TypeORM
                if (this.readyResolve) {
                    this.readyResolve();
                    this.readyResolve = null;
                }
                this.logger.log(`Túnel SSH activo → localhost:${this.localPort} → ${forwardOptions.dstAddr}:${forwardOptions.dstPort}`);
                server.on("error", (err) => {
                    this.logger.error(`Error en el túnel: ${err.message}`);
                    this.reconnect();
                });
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.logger.error(`Error abriendo túnel SSH: ${message}`);
                this.logger.log("Reintentando en 10 segundos...");
                setTimeout(() => this.openTunnel(), 10000);
            }
        }
        closeTunnel() {
            if (this.tunnelServer) {
                this.tunnelServer.close();
                this.tunnelServer = null;
                this.ready = false;
                this.logger.log("🔴 Túnel SSH cerrado");
            }
        }
        async reconnect() {
            this.logger.log("Reconectando túnel SSH...");
            this.closeTunnel();
            // Resetear la promesa de ready
            this.readyPromise = new Promise((resolve) => {
                this.readyResolve = resolve;
            });
            await new Promise((r) => setTimeout(r, 5000));
            await this.openTunnel();
        }
    };
    __setFunctionName(_classThis, "TunnelService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TunnelService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TunnelService = _classThis;
})();
exports.TunnelService = TunnelService;

"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __esDecorate =
  (this && this.__esDecorate) ||
  function (
    ctor,
    descriptorIn,
    decorators,
    contextIn,
    initializers,
    extraInitializers,
  ) {
    function accept(f) {
      if (f !== void 0 && typeof f !== "function")
        throw new TypeError("Function expected");
      return f;
    }
    var kind = contextIn.kind,
      key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target =
      !descriptorIn && ctor
        ? contextIn["static"]
          ? ctor
          : ctor.prototype
        : null;
    var descriptor =
      descriptorIn ||
      (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _,
      done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
      var context = {};
      for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
      for (var p in contextIn.access) context.access[p] = contextIn.access[p];
      context.addInitializer = function (f) {
        if (done)
          throw new TypeError(
            "Cannot add initializers after decoration has completed",
          );
        extraInitializers.push(accept(f || null));
      };
      var result = (0, decorators[i])(
        kind === "accessor"
          ? { get: descriptor.get, set: descriptor.set }
          : descriptor[key],
        context,
      );
      if (kind === "accessor") {
        if (result === void 0) continue;
        if (result === null || typeof result !== "object")
          throw new TypeError("Object expected");
        if ((_ = accept(result.get))) descriptor.get = _;
        if ((_ = accept(result.set))) descriptor.set = _;
        if ((_ = accept(result.init))) initializers.unshift(_);
      } else if ((_ = accept(result))) {
        if (kind === "field") initializers.unshift(_);
        else descriptor[key] = _;
      }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
  };
var __runInitializers =
  (this && this.__runInitializers) ||
  function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
      value = useValue
        ? initializers[i].call(thisArg, value)
        : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
  };
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
var __setFunctionName =
  (this && this.__setFunctionName) ||
  function (f, name, prefix) {
    if (typeof name === "symbol")
      name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", {
      configurable: true,
      value: prefix ? "".concat(prefix, " ", name) : name,
    });
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const common_1 = require("@nestjs/common");
const oracledb = __importStar(require("oracledb"));
let DatabaseService = (() => {
  let _classDecorators = [(0, common_1.Injectable)()];
  let _classDescriptor;
  let _classExtraInitializers = [];
  let _classThis;
  var DatabaseService = (_classThis = class {
    constructor(config, tunnel) {
      this.config = config;
      this.tunnel = tunnel;
      this.logger = new common_1.Logger(DatabaseService.name);
      this.pool = null;
    }
    async onModuleInit() {
      // Esperar que el túnel esté listo antes de crear el pool
      await this.tunnel.waitUntilReady();
      await this.createPool();
    }
    async createPool() {
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
    enableThickMode() {
      if (!oracledb.thin) {
        return;
      }
      const libDir = this.config.get("ORA_CLIENT_LIB_DIR");
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
    async query(sql, params = []) {
      if (!this.pool) throw new Error("Pool de Oracle no inicializado");
      const conn = await this.pool.getConnection();
      try {
        const result = await conn.execute(sql, params, {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          fetchArraySize: 100,
        });
        return result.rows || [];
      } finally {
        await conn.close();
      }
    }
    // ─── Ejecutar INSERT/UPDATE/DELETE ────────────────────────────────────────
    async execute(sql, params = []) {
      if (!this.pool) throw new Error("Pool de Oracle no inicializado");
      const conn = await this.pool.getConnection();
      try {
        const result = await conn.execute(sql, params, { autoCommit: true });
        return result;
      } finally {
        await conn.close();
      }
    }
  });
  __setFunctionName(_classThis, "DatabaseService");
  (() => {
    const _metadata =
      typeof Symbol === "function" && Symbol.metadata
        ? Object.create(null)
        : void 0;
    __esDecorate(
      null,
      (_classDescriptor = { value: _classThis }),
      _classDecorators,
      { kind: "class", name: _classThis.name, metadata: _metadata },
      null,
      _classExtraInitializers,
    );
    DatabaseService = _classThis = _classDescriptor.value;
    if (_metadata)
      Object.defineProperty(_classThis, Symbol.metadata, {
        enumerable: true,
        configurable: true,
        writable: true,
        value: _metadata,
      });
    __runInitializers(_classThis, _classExtraInitializers);
  })();
  return (DatabaseService = _classThis);
})();
exports.DatabaseService = DatabaseService;

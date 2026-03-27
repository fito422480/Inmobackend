"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CuotasPagadasController = void 0;
const common_1 = require("@nestjs/common");
let CuotasPagadasController = (() => {
    let _classDecorators = [(0, common_1.Controller)('cuotas-pagadas')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _findAll_decorators;
    var CuotasPagadasController = _classThis = class {
        constructor(service) {
            this.service = (__runInitializers(this, _instanceExtraInitializers), service);
        }
        /**
         * GET /cuotas-pagadas
         *
         * Query params:
         *   limite              número de registros por página (default: 100, max: 1000)
         *   offset              desde qué registro empezar (default: 0)
         *   numeroContrato      filtrar por contrato
         *   documento           filtrar por documento del cliente
         *   idCliente           filtrar por ID de cliente
         *   sucursal            filtrar por sucursal
         *   estadoActualContrato filtrar por estado
         *   moneda              filtrar por moneda (PYG, USD, etc.)
         *   fechaDesde          filtrar FECHA_PAGO >= (YYYY-MM-DD)
         *   fechaHasta          filtrar FECHA_PAGO <= (YYYY-MM-DD)
         *   incluirTotal        true|false (si es false evita COUNT(*) para responder más rápido)
         *
         * Ejemplos:
         *   GET /cuotas-pagadas?limite=100&offset=0
         *   GET /cuotas-pagadas?limite=100&offset=0&incluirTotal=false
         *   GET /cuotas-pagadas?limite=50&offset=200&sucursal=CDE
         *   GET /cuotas-pagadas?documento=1234567&limite=100&offset=0
         *   GET /cuotas-pagadas?fechaDesde=2024-01-01&fechaHasta=2024-12-31&limite=100&offset=0
         */
        findAll(limite, offset, numeroContrato, documento, idCliente, sucursal, estadoActualContrato, moneda, fechaDesde, fechaHasta, incluirTotal) {
            return this.service.findAll({
                limite: parseInt(limite) || 100,
                offset: parseInt(offset) || 0,
                incluirTotal: this.parseBoolean(incluirTotal),
                numeroContrato,
                documento,
                idCliente: idCliente ? parseInt(idCliente) : undefined,
                sucursal,
                estadoActualContrato,
                moneda,
                fechaDesde,
                fechaHasta,
            });
        }
        parseBoolean(value) {
            if (value === undefined) {
                return undefined;
            }
            return !['0', 'false', 'no'].includes(value.toLowerCase());
        }
    };
    __setFunctionName(_classThis, "CuotasPagadasController");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _findAll_decorators = [(0, common_1.Get)()];
        __esDecorate(_classThis, null, _findAll_decorators, { kind: "method", name: "findAll", static: false, private: false, access: { has: obj => "findAll" in obj, get: obj => obj.findAll }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CuotasPagadasController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CuotasPagadasController = _classThis;
})();
exports.CuotasPagadasController = CuotasPagadasController;

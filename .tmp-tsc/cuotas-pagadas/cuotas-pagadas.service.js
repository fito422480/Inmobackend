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
exports.CuotasPagadasService = void 0;
const common_1 = require("@nestjs/common");
let CuotasPagadasService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var CuotasPagadasService = _classThis = class {
        constructor(repo, dataSource) {
            this.repo = repo;
            this.dataSource = dataSource;
        }
        async findAll(dto) {
            const limite = Math.min(dto.limite || 100, 1000); // máximo 1000 por página
            const offset = Math.max(dto.offset || 0, 0);
            const incluirTotal = dto.incluirTotal !== false;
            const pagina = Math.floor(offset / limite) + 1;
            // ── Construcción dinámica de filtros ──────────────────────────────────────
            const qb = this.repo.createQueryBuilder('v');
            if (dto.numeroContrato) {
                qb.andWhere('v.numeroContrato = :numeroContrato', { numeroContrato: dto.numeroContrato });
            }
            if (dto.documento) {
                qb.andWhere('v.documento = :documento', { documento: dto.documento });
            }
            if (dto.idCliente) {
                qb.andWhere('v.idCliente = :idCliente', { idCliente: dto.idCliente });
            }
            if (dto.sucursal) {
                qb.andWhere('v.sucursal = :sucursal', { sucursal: dto.sucursal });
            }
            if (dto.estadoActualContrato) {
                qb.andWhere('v.estadoActualContrato = :estado', { estado: dto.estadoActualContrato });
            }
            if (dto.moneda) {
                qb.andWhere('v.moneda = :moneda', { moneda: dto.moneda });
            }
            if (dto.fechaDesde) {
                qb.andWhere('v.fechaPago >= TO_DATE(:fechaDesde, \'YYYY-MM-DD\')', { fechaDesde: dto.fechaDesde });
            }
            if (dto.fechaHasta) {
                qb.andWhere('v.fechaPago <= TO_DATE(:fechaHasta, \'YYYY-MM-DD\')', { fechaHasta: dto.fechaHasta });
            }
            if (!incluirTotal) {
                const data = await qb
                    .clone()
                    .orderBy('v.fechaPago', 'DESC')
                    .skip(offset)
                    .take(limite + 1)
                    .getMany();
                const tieneMas = data.length > limite;
                return {
                    data: data.slice(0, limite),
                    total: null,
                    limite,
                    offset,
                    pagina,
                    totalPaginas: null,
                    incluirTotal: false,
                    tieneMas,
                };
            }
            // ── Ejecutar conteo y página en paralelo para bajar latencia total ───────
            const [total, data] = await Promise.all([
                qb.clone().getCount(),
                qb
                    .clone()
                    .orderBy('v.fechaPago', 'DESC')
                    .skip(offset)
                    .take(limite)
                    .getMany(),
            ]);
            return {
                data,
                total,
                limite,
                offset,
                pagina,
                totalPaginas: Math.ceil(total / limite),
                incluirTotal: true,
            };
        }
        // ── Método alternativo con SQL nativo para Oracle 11g o mejor rendimiento ──
        async findAllNativo(dto) {
            const limite = Math.min(dto.limite || 100, 1000);
            const offset = dto.offset || 0;
            // Parámetros dinámicos
            const params = { limite, offset };
            const filtros = [];
            if (dto.numeroContrato) {
                filtros.push(`NUMERO_CONTRATO = :numeroContrato`);
                params.numeroContrato = dto.numeroContrato;
            }
            if (dto.documento) {
                filtros.push(`DOCUMENTO = :documento`);
                params.documento = dto.documento;
            }
            if (dto.idCliente) {
                filtros.push(`ID_CLIENTE = :idCliente`);
                params.idCliente = dto.idCliente;
            }
            if (dto.sucursal) {
                filtros.push(`SUCURSAL = :sucursal`);
                params.sucursal = dto.sucursal;
            }
            if (dto.estadoActualContrato) {
                filtros.push(`ESTADO_ACTUAL_CONTRATO = :estado`);
                params.estado = dto.estadoActualContrato;
            }
            if (dto.moneda) {
                filtros.push(`MONEDA = :moneda`);
                params.moneda = dto.moneda;
            }
            if (dto.fechaDesde) {
                filtros.push(`FECHA_PAGO >= TO_DATE(:fechaDesde, 'YYYY-MM-DD')`);
                params.fechaDesde = dto.fechaDesde;
            }
            if (dto.fechaHasta) {
                filtros.push(`FECHA_PAGO <= TO_DATE(:fechaHasta, 'YYYY-MM-DD')`);
                params.fechaHasta = dto.fechaHasta;
            }
            const whereClause = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';
            // ROW_NUMBER() para compatibilidad con Oracle 11g también
            const sqlData = `
      SELECT *
      FROM (
        SELECT v.*, ROW_NUMBER() OVER (ORDER BY FECHA_PAGO DESC) AS RN
        FROM ADCC.CBI_CUOTAS_PAGADAS_V v
        ${whereClause}
      )
      WHERE RN > :offset AND RN <= (:offset + :limite)
    `;
            const sqlCount = `
      SELECT COUNT(*) AS TOTAL
      FROM ADCC.CBI_CUOTAS_PAGADAS_V
      ${whereClause}
    `;
            const [dataResult, countResult] = await Promise.all([
                this.dataSource.query(sqlData, params),
                this.dataSource.query(sqlCount, params),
            ]);
            const total = parseInt(countResult[0]?.TOTAL || '0');
            return {
                data: dataResult,
                total,
                limite,
                offset,
                pagina: Math.floor(offset / limite) + 1,
                totalPaginas: Math.ceil(total / limite),
                incluirTotal: true,
            };
        }
    };
    __setFunctionName(_classThis, "CuotasPagadasService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CuotasPagadasService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CuotasPagadasService = _classThis;
})();
exports.CuotasPagadasService = CuotasPagadasService;

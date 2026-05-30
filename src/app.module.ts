import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TunnelModule } from './tunnel/tunnel.module';
import { DatabaseModule } from './database/database.module';
import { ApiKeyGuard } from './auth/api-key.guard';
import { ClientesModule } from './clientes/clientes.module';
import { RequestTimingInterceptor } from './common/request-timing.interceptor';
import { CobranzasModule } from './cobranzas/cobranzas.module';
import { CobranzasV2Module } from './cobranzas-v2/cobranzas.module';
import { CuotasPagadasModule } from './cuotas-pagadas/cuotas-pagadas.module';
import { CuotasVencidasModule } from './cuotas-vencidas/cuotas-vencidas.module';
import { DetalleCuotasModule } from './detalle-cuotas/detalle-cuotas.module';
import { CuotasGeneralModule } from './cuotas-general/cuotas-general.module';
import { EstadoCuentasModule } from './estado-cuentas/estado-cuentas.module';
import { LotesModule } from './lotes/lotes.module';
import { TotalPagadoModule } from './total-pagado/total-pagado.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TunnelModule,
    DatabaseModule,
    ClientesModule,
    CobranzasModule,
    CobranzasV2Module,
    CuotasPagadasModule,
    CuotasVencidasModule,
    DetalleCuotasModule,
    CuotasGeneralModule,
    EstadoCuentasModule,
    LotesModule,
    TotalPagadoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestTimingInterceptor,
    },
  ],
})
export class AppModule {}

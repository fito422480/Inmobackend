import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TunnelModule } from './tunnel/tunnel.module';
import { DatabaseModule } from './database/database.module';
import { ApiKeyGuard } from './auth/api-key.guard';
import { ClientesModule } from './clientes/clientes.module';
import { RequestTimingInterceptor } from './common/request-timing.interceptor';
import { CuotasPagadasModule } from './cuotas-pagadas/cuotas-pagadas.module';
import { CuotasVencidasModule } from './cuotas-vencidas/cuotas-vencidas.module';
import { LotesModule } from './lotes/lotes.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TunnelModule,
    DatabaseModule,
    ClientesModule,
    CuotasPagadasModule,
    CuotasVencidasModule,
    LotesModule,
    // Agregá acá tus módulos
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

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TunnelModule } from './tunnel/tunnel.module';
import { DatabaseModule } from './database/database.module';
import { CuotasPagadasModule } from './cuotas-pagadas/cuotas-pagadas.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TunnelModule,
    DatabaseModule,
    CuotasPagadasModule,
    // Agregá acá tus módulos
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

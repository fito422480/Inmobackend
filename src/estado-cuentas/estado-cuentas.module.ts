import { Module } from '@nestjs/common';
import { EstadoCuentasController } from './estado-cuentas.controller';
import { EstadoCuentasService } from './estado-cuentas.service';

@Module({
  providers: [EstadoCuentasService],
  controllers: [EstadoCuentasController],
})
export class EstadoCuentasModule {}

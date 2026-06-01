import { Module } from '@nestjs/common';
import { PagosPorFranjaController } from './pagos-por-franja.controller';
import { PagosPorFranjaService } from './pagos-por-franja.service';

@Module({
  providers: [PagosPorFranjaService],
  controllers: [PagosPorFranjaController],
})
export class PagosPorFranjaModule {}

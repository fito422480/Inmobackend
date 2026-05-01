import { Module } from '@nestjs/common';
import { DetalleCuotasController } from './detalle-cuotas.controller';
import { DetalleCuotasService } from './detalle-cuotas.service';

@Module({
  providers: [DetalleCuotasService],
  controllers: [DetalleCuotasController],
})
export class DetalleCuotasModule {}

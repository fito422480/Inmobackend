import { Module } from '@nestjs/common';
import { CuotasGeneralController } from './cuotas-general.controller';
import { CuotasGeneralService } from './cuotas-general.service';

@Module({
  providers: [CuotasGeneralService],
  controllers: [CuotasGeneralController],
})
export class CuotasGeneralModule {}

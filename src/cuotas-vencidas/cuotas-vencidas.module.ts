import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuotasVencidasEntity } from './cuotas-vencidas.entity';
import { CuotasVencidasService } from './cuotas-vencidas.service';
import { CuotasVencidasController } from './cuotas-vencidas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CuotasVencidasEntity])],
  providers: [CuotasVencidasService],
  controllers: [CuotasVencidasController],
})
export class CuotasVencidasModule {}

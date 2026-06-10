import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TotalPagadoMesController } from './total-pagado-mes.controller';
import { TotalPagadoMesEntity } from './total-pagado-mes.entity';
import { TotalPagadoMesService } from './total-pagado-mes.service';

@Module({
  imports: [TypeOrmModule.forFeature([TotalPagadoMesEntity])],
  providers: [TotalPagadoMesService],
  controllers: [TotalPagadoMesController],
})
export class TotalPagadoMesModule {}

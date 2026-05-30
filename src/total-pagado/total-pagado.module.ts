import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TotalPagadoController } from './total-pagado.controller';
import { TotalPagadoEntity } from './total-pagado.entity';
import { TotalPagadoService } from './total-pagado.service';

@Module({
  imports: [TypeOrmModule.forFeature([TotalPagadoEntity])],
  providers: [TotalPagadoService],
  controllers: [TotalPagadoController],
})
export class TotalPagadoModule {}

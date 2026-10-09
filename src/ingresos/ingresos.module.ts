import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngresosController } from './ingresos.controller';
import { IngresosEntity } from './ingresos.entity';
import { IngresosService } from './ingresos.service';

@Module({
  imports: [TypeOrmModule.forFeature([IngresosEntity])],
  providers: [IngresosService],
  controllers: [IngresosController],
})
export class IngresosModule {}

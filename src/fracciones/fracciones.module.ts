import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraccionesController } from './fracciones.controller';
import { FraccionesEntity } from './fracciones.entity';
import { FraccionesService } from './fracciones.service';

@Module({
  imports: [TypeOrmModule.forFeature([FraccionesEntity])],
  providers: [FraccionesService],
  controllers: [FraccionesController],
})
export class FraccionesModule {}

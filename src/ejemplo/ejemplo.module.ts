import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EjemploEntity } from './ejemplo.entity';
import { EjemploService } from './ejemplo.service';
import { EjemploController } from './ejemplo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EjemploEntity])],
  providers: [EjemploService],
  controllers: [EjemploController],
})
export class EjemploModule {}

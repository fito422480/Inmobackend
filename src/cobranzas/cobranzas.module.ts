import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobranzasController } from './cobranzas.controller';
import { CobranzasEntity } from './cobranzas.entity';
import { CobranzasService } from './cobranzas.service';

@Module({
  imports: [TypeOrmModule.forFeature([CobranzasEntity])],
  providers: [CobranzasService],
  controllers: [CobranzasController],
})
export class CobranzasModule {}

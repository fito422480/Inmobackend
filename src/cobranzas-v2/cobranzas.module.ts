import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobranzasV2Controller } from './cobranzas.controller';
import { CobranzasV2Entity } from './cobranzas.entity';
import { CobranzasV2Service } from './cobranzas.service';

@Module({
  imports: [TypeOrmModule.forFeature([CobranzasV2Entity])],
  providers: [CobranzasV2Service],
  controllers: [CobranzasV2Controller],
})
export class CobranzasV2Module {}

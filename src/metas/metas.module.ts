import { Module } from '@nestjs/common';
import { MetasController } from './metas.controller';
import { MetasService } from './metas.service';

@Module({
  providers: [MetasService],
  controllers: [MetasController],
})
export class MetasModule {}

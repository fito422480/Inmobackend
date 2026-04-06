import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LotesController } from './lotes.controller';
import { LotesEntity } from './lotes.entity';
import { LotesService } from './lotes.service';

@Module({
  imports: [TypeOrmModule.forFeature([LotesEntity])],
  providers: [LotesService],
  controllers: [LotesController],
})
export class LotesModule {}

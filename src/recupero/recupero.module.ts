import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecuperoController } from './recupero.controller';
import { RecuperoEntity } from './recupero.entity';
import { RecuperoService } from './recupero.service';

@Module({
  imports: [TypeOrmModule.forFeature([RecuperoEntity])],
  providers: [RecuperoService],
  controllers: [RecuperoController],
})
export class RecuperoModule {}

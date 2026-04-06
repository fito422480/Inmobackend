import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesController } from './clientes.controller';
import { ClientesEntity } from './clientes.entity';
import { ClientesService } from './clientes.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientesEntity])],
  providers: [ClientesService],
  controllers: [ClientesController],
})
export class ClientesModule {}

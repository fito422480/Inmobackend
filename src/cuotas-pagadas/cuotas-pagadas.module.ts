import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuotasPagadasEntity } from './cuotas-pagadas.entity';
import { CuotasPagadasService } from './cuotas-pagadas.service';
import { CuotasPagadasController } from './cuotas-pagadas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CuotasPagadasEntity])],
  providers: [CuotasPagadasService],
  controllers: [CuotasPagadasController],
})
export class CuotasPagadasModule {}

import { Module, Global } from '@nestjs/common';
import { TunnelService } from './tunnel.service';

@Global()
@Module({
  providers: [TunnelService],
  exports: [TunnelService],
})
export class TunnelModule {}

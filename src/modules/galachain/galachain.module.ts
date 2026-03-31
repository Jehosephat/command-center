import { Module, Global } from '@nestjs/common';
import { GalaChainGatewayService } from './galachain-gateway.service';

@Global()
@Module({
  providers: [GalaChainGatewayService],
  exports: [GalaChainGatewayService],
})
export class GalaChainModule {}

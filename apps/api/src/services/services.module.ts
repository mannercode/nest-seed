import { Module } from '@nestjs/common'
import { ApplicationModule } from './application'
import { CoreModule } from './core'
import { GatewayModule } from './gateway'
import { InfrastructureModule } from './infrastructure'

/**
 * 4 레이어 (core / infrastructure / application / gateway) 를 한 묶음으로 노출한다.
 * AppModule 이 4 개를 따로 import 하지 않고 이 모듈만 import 하면 services 의
 * 모든 레이어가 따라온다.
 */
@Module({
    imports: [CoreModule, InfrastructureModule, ApplicationModule, GatewayModule],
    exports: [CoreModule, InfrastructureModule, ApplicationModule, GatewayModule]
})
export class ServicesModule {}

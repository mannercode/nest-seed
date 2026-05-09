import { Module } from '@nestjs/common'
import { ApplicationModule } from 'application'
import {
    MongooseConfigModule,
    NatsConfigModule,
    RedisConfigModule,
    TemporalConfigModule
} from 'config'
import { CoreModule } from 'core'
import { InfrastructureModule } from 'infrastructure'
import { GatewayModule } from './gateway'
import { GlobalModule } from './global.module'
import { HealthModule } from './health.module'

@Module({
    imports: [
        GlobalModule,
        MongooseConfigModule,
        RedisConfigModule,
        NatsConfigModule,
        TemporalConfigModule,
        HealthModule,
        CoreModule,
        InfrastructureModule,
        ApplicationModule,
        GatewayModule
    ]
})
export class AppModule {}

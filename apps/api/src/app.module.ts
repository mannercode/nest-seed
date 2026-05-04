import { Module } from '@nestjs/common'
import { ApplicationsModule } from 'applications'
import {
    CommonModule,
    MongooseConfigModule,
    NatsConfigModule,
    RedisConfigModule,
    TemporalConfigModule
} from 'config'
import { CoresModule } from 'cores'
import { InfrastructuresModule } from 'infrastructures'
import { GatewayModule } from './gateway'
import { HealthModule } from './modules'

@Module({
    imports: [
        CommonModule,
        MongooseConfigModule,
        RedisConfigModule,
        NatsConfigModule,
        TemporalConfigModule,
        HealthModule,
        CoresModule,
        InfrastructuresModule,
        ApplicationsModule,
        GatewayModule
    ]
})
export class AppModule {}

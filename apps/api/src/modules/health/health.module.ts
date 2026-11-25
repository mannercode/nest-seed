import { MongoHealthIndicator, NatsHealthIndicator, RedisHealthIndicator } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { EventDemoModule } from '#infrastructure'
import { HealthController } from './health.controller.js'
import { HealthService } from './health.service.js'
import { RestateHealthIndicator } from './restate.health-indicator.js'

@Module({
    imports: [EventDemoModule],
    controllers: [HealthController],
    providers: [
        HealthService,
        MongoHealthIndicator,
        NatsHealthIndicator,
        RedisHealthIndicator,
        RestateHealthIndicator
    ]
})
export class HealthModule {}

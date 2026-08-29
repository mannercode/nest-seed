import { NatsHealthIndicator, RedisHealthIndicator } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller.js'
import { HealthService } from './health.service.js'
import { RestateHealthIndicator } from './restate.health-indicator.js'

@Module({
    controllers: [HealthController],
    providers: [HealthService, NatsHealthIndicator, RedisHealthIndicator, RestateHealthIndicator]
})
export class HealthModule {}

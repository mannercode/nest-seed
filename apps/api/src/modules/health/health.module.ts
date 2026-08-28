import { NatsHealthIndicator, RedisHealthIndicator } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'
import { RestateHealthIndicator } from './restate.health-indicator'

@Module({
    controllers: [HealthController],
    providers: [HealthService, NatsHealthIndicator, RedisHealthIndicator, RestateHealthIndicator]
})
export class HealthModule {}

import {
    NatsHealthIndicator,
    RedisHealthIndicator,
    TemporalHealthIndicator
} from '@mannercode/common'
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

@Module({
    controllers: [HealthController],
    providers: [HealthService, NatsHealthIndicator, RedisHealthIndicator, TemporalHealthIndicator]
})
export class HealthModule {}

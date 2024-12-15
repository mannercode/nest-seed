import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { RedisHealthIndicator } from 'common'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

@Module({
    imports: [TerminusModule],
    providers: [HealthService, RedisHealthIndicator],
    controllers: [HealthController],
    exports: [HealthService]
})
export class HealthModule {}

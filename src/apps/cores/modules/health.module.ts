import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common'
import { HealthCheckService, MongooseHealthIndicator, TerminusModule } from '@nestjs/terminus'
import { RedisHealthIndicator } from 'common'
import Redis from 'ioredis'
import mongoose from 'mongoose'
import { MongooseConfigModule, RedisConfigModule } from 'shared'

@Injectable()
class HealthService {
    constructor(
        private readonly health: HealthCheckService,
        private readonly mongooseHealth: MongooseHealthIndicator,
        private readonly redis: RedisHealthIndicator,
        @Inject(MongooseConfigModule.moduleName) private readonly mongoConn: mongoose.Connection,
        @Inject(RedisConfigModule.moduleName) private readonly redisConn: Redis
    ) {}

    check() {
        const checks = [
            async () => this.mongooseHealth.pingCheck('mongodb', { connection: this.mongoConn }),
            async () => this.redis.isHealthy('redis', this.redisConn)
        ]

        return this.health.check(checks)
    }
}

@Controller()
class HealthController {
    constructor(private readonly service: HealthService) {}

    @Get('health')
    health() {
        return this.service.check()
    }
}

@Module({
    imports: [TerminusModule],
    providers: [HealthService, RedisHealthIndicator],
    controllers: [HealthController]
})
export class HealthModule {}

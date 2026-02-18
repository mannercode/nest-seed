import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common'
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus'
import { TerminusModule } from '@nestjs/terminus'
import { RedisHealthIndicator } from 'common'
import Redis from 'ioredis'
import mongoose from 'mongoose'
import { MongooseConfigModule, RedisConfigModule } from 'shared'

@Injectable()
class HealthService {
    constructor(
        private readonly health: HealthCheckService,
        private readonly mongooseHealth: MongooseHealthIndicator,
        private readonly redisHealth: RedisHealthIndicator,
        @Inject(MongooseConfigModule.moduleName)
        private readonly mongoConnection: mongoose.Connection,
        @Inject(RedisConfigModule.moduleName) private readonly redisConnection: Redis
    ) {}

    check() {
        const checks = [
            async () =>
                this.mongooseHealth.pingCheck('mongodb', { connection: this.mongoConnection }),
            async () => this.redisHealth.isHealthy('redis', this.redisConnection)
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
    controllers: [HealthController],
    imports: [TerminusModule],
    providers: [HealthService, RedisHealthIndicator]
})
export class HealthModule {}

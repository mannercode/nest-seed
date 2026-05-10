import { getRedisConnectionToken, RedisHealthIndicator } from '@mannercode/common'
import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common'
import { getConnectionToken } from '@nestjs/mongoose'
import { HealthCheckService, MongooseHealthIndicator, TerminusModule } from '@nestjs/terminus'
import { MONGO_CONNECTION_NAME, REDIS_CONNECTION_NAME } from 'config'
import Redis from 'ioredis'
import mongoose from 'mongoose'

@Injectable()
class HealthService {
    constructor(
        private readonly health: HealthCheckService,
        private readonly mongooseHealth: MongooseHealthIndicator,
        private readonly redisHealth: RedisHealthIndicator,
        @Inject(getConnectionToken(MONGO_CONNECTION_NAME))
        private readonly mongoConnection: mongoose.Connection,
        @Inject(getRedisConnectionToken(REDIS_CONNECTION_NAME))
        private readonly redisConnection: Redis
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

@Controller('health')
class HealthController {
    constructor(private readonly service: HealthService) {}

    @Get()
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

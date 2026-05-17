import { getRedisConnectionToken, RedisHealthIndicator } from '@mannercode/common'
import { Inject, Injectable } from '@nestjs/common'
import { getConnectionToken } from '@nestjs/mongoose'
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus'
import { MONGO_CONNECTION_NAME, REDIS_CONNECTION_NAME } from 'config'
import Redis from 'ioredis'
import mongoose from 'mongoose'

@Injectable()
export class HealthService {
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

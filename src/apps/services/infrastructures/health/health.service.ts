import { Inject, Injectable } from '@nestjs/common'
import { getConnectionToken } from '@nestjs/mongoose'
import {
    HealthCheckService,
    MemoryHealthIndicator,
    MongooseHealthIndicator
} from '@nestjs/terminus'
import { Byte, RedisHealthIndicator, RedisModule } from 'common'
import Redis from 'ioredis'
import mongoose from 'mongoose'
import { isTest, MongooseConfig, RedisConfig } from 'services/config'

@Injectable()
export class HealthService {
    constructor(
        private health: HealthCheckService,
        private mongoose: MongooseHealthIndicator,
        private memory: MemoryHealthIndicator,
        private redis: RedisHealthIndicator,
        @Inject(getConnectionToken(MongooseConfig.connName)) private mongoConn: mongoose.Connection,
        @Inject(RedisModule.getToken(RedisConfig.connName)) private redisConn: Redis
    ) {}

    check() {
        const checks = [
            async () =>
                this.mongoose.pingCheck(MongooseConfig.connName, { connection: this.mongoConn }),
            async () => this.redis.pingCheck(RedisConfig.connName, this.redisConn)
        ]

        /* istanbul ignore next */
        if (!isTest()) {
            checks.push(
                async () => this.memory.checkHeap('memory_heap', Byte.fromString('150MB')),
                async () => this.memory.checkRSS('memory_rss', Byte.fromString('300MB'))
            )
        }

        return this.health.check(checks)
    }
}

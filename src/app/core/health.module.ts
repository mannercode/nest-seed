import { Inject, Injectable, Module } from '@nestjs/common'
import { getConnectionToken } from '@nestjs/mongoose'
import {
    HealthCheckService,
    MemoryHealthIndicator,
    MongooseHealthIndicator,
    TerminusModule
} from '@nestjs/terminus'
import { Byte, RedisHealthIndicator, RedisModule } from 'common'
import { isTest, MongooseConfig, RedisConfig } from 'config'
import Redis from 'ioredis'
import mongoose from 'mongoose'

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

@Module({
    imports: [TerminusModule],
    providers: [HealthService, RedisHealthIndicator],
    exports: [HealthService]
})
export class HealthModule {}

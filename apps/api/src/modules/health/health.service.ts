import {
    getNatsConnectionToken,
    getRedisConnectionToken,
    getTemporalConnectionToken,
    NatsHealthIndicator,
    RedisHealthIndicator,
    TemporalHealthIndicator,
    type NatsConnection
} from '@mannercode/common'
import { Inject, Injectable } from '@nestjs/common'
import { getConnectionToken } from '@nestjs/mongoose'
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus'
import { Connection } from '@temporalio/client'
import {
    MONGO_CONNECTION_NAME,
    NATS_CONNECTION_NAME,
    REDIS_CONNECTION_NAME,
    TEMPORAL_CLIENT_NAME
} from 'config'
import Redis from 'ioredis'
import mongoose from 'mongoose'

@Injectable()
export class HealthService {
    constructor(
        private readonly health: HealthCheckService,
        private readonly mongooseHealth: MongooseHealthIndicator,
        private readonly redisHealth: RedisHealthIndicator,
        private readonly natsHealth: NatsHealthIndicator,
        private readonly temporalHealth: TemporalHealthIndicator,
        @Inject(getConnectionToken(MONGO_CONNECTION_NAME))
        private readonly mongoConnection: mongoose.Connection,
        @Inject(getRedisConnectionToken(REDIS_CONNECTION_NAME))
        private readonly redisConnection: Redis,
        @Inject(getNatsConnectionToken(NATS_CONNECTION_NAME))
        private readonly natsConnection: NatsConnection,
        @Inject(getTemporalConnectionToken(TEMPORAL_CLIENT_NAME))
        private readonly temporalConnection: Connection
    ) {}

    check() {
        // 이벤트 전달(NATS)과 사가(Temporal)도 핵심 기능이므로, 끊겨 있으면 healthy로 보고하지 않는다.
        const checks = [
            async () =>
                this.mongooseHealth.pingCheck('mongodb', { connection: this.mongoConnection }),
            async () => this.redisHealth.isHealthy('redis', this.redisConnection),
            async () => this.natsHealth.isHealthy('nats', this.natsConnection),
            async () => this.temporalHealth.isHealthy('temporal', this.temporalConnection)
        ]

        return this.health.check(checks)
    }
}

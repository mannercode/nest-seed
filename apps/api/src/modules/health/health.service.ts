import {
    getNatsConnectionToken,
    getRedisConnectionToken,
    getTemporalConnectionToken,
    NatsHealthIndicator,
    RedisHealthIndicator,
    TemporalHealthIndicator,
    type NatsConnection
} from '@mannercode/common'
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { getConnectionToken } from '@nestjs/mongoose'
import { Connection } from '@temporalio/client'
import {
    MONGO_CONNECTION_NAME,
    NATS_CONNECTION_NAME,
    REDIS_CONNECTION_NAME,
    TEMPORAL_CLIENT_NAME
} from 'config'
import Redis from 'ioredis'
import mongoose from 'mongoose'

type HealthState = { status: 'down' | 'up' } & Record<string, unknown>
type HealthCheckResult = Record<string, HealthState>

@Injectable()
export class HealthService {
    constructor(
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

    async check() {
        // 이벤트 전달(NATS)과 사가(Temporal)도 핵심 기능이므로, 끊겨 있으면 healthy로 보고하지 않는다.
        const results: HealthCheckResult[] = await Promise.all([
            this.checkMongo(),
            this.redisHealth.isHealthy('redis', this.redisConnection),
            this.natsHealth.isHealthy('nats', this.natsConnection),
            this.temporalHealth.isHealthy('temporal', this.temporalConnection)
        ])
        const info: HealthCheckResult = {}
        const error: HealthCheckResult = {}

        results.forEach((result) => {
            Object.entries(result).forEach(([key, state]) => {
                const target = state.status === 'up' ? info : error
                target[key] = state
            })
        })

        const response = { details: { ...info, ...error }, error, info }

        if (Object.keys(error).length > 0) {
            throw new ServiceUnavailableException({ status: 'error', ...response })
        }

        return { status: 'ok', ...response }
    }

    private async checkMongo(): Promise<HealthCheckResult> {
        try {
            const database = this.mongoConnection.db as NonNullable<mongoose.Connection['db']>
            await database.command({ ping: 1 })

            return { mongodb: { status: 'up' } }
        } catch (caught: unknown) {
            return { mongodb: { reason: String(caught), status: 'down' } }
        }
    }
}

import type { HealthIndicatorService } from '@nestjs/terminus'
import type Redis from 'ioredis'
import { Injectable } from '@nestjs/common'
import { defaultTo, get } from 'lodash'

@Injectable()
export class RedisHealthIndicator {
    constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

    async isHealthy(key: string, redis: Redis) {
        const indicator = this.healthIndicatorService.check(key)

        try {
            await redis.ping()

            return indicator.up()
        } catch (error: unknown) {
            const message = get(error, 'message', String(error))

            const reason = defaultTo(message, error)
            return indicator.down({ reason })
        }
    }
}

import { Injectable } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'
import Redis from 'ioredis'
import { Or } from '../validator'

@Injectable()
export class RedisHealthIndicator {
    constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

    async isHealthy(key: string, redis: Redis) {
        const indicator = this.healthIndicatorService.check(key)

        try {
            await redis.ping()

            return indicator.up()
        } catch (error) {
            const reason = Or(error.message, error)
            return indicator.down({ reason })
        }
    }
}

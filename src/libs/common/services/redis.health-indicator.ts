import { Injectable } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'
import Redis from 'ioredis'

@Injectable()
export class RedisHealthIndicator {
    constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

    async isHealthy(key: string, connection: Redis) {
        // Start the health indicator check for the given key
        const indicator = this.healthIndicatorService.check(key)

        try {
            const pong = await connection.ping()
            if (pong === 'PONG') {
                return indicator.up()
            }

            /* istanbul ignore next */
            return indicator.down({ reason: 'Redis ping failed' })
        } catch (error) {
            /* istanbul ignore next */
            return indicator.down({ reason: error.message ?? 'RedisHealthIndicator failed' })
        }
    }
}

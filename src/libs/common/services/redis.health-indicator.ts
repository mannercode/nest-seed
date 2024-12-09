import { Injectable } from '@nestjs/common'
import { HealthCheckError, HealthIndicator } from '@nestjs/terminus'
import Redis from 'ioredis'

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
    constructor() {
        super()
    }

    async pingCheck(key: string, connection: Redis) {
        try {
            const pong = await connection.ping()
            if (pong === 'PONG') {
                return this.getStatus(key, true)
            }
            /* istanbul ignore next */
            throw new Error('Redis ping failed')
        } catch (_error) {
            /* istanbul ignore next */
            throw new HealthCheckError('RedisHealthIndicator failed', this.getStatus(key, false))
        }
    }
}

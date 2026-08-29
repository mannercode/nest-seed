import { Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { getByPath } from '../utils/index.js'

@Injectable()
export class RedisHealthIndicator {
    async isHealthy(key: string, redis: Redis) {
        try {
            await redis.ping()

            return { [key]: { status: 'up' as const } }
        } catch (error: unknown) {
            const reason = getByPath(error, 'message', String(error))
            return { [key]: { reason, status: 'down' as const } }
        }
    }
}

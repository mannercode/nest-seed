import { Injectable } from '@nestjs/common'
import type { RedisConnection } from '#common/redis'
import { getByPath } from '#common/utils'

@Injectable()
export class RedisHealthIndicator {
    async isHealthy(key: string, redis: RedisConnection) {
        try {
            await redis.ping()

            return { [key]: { status: 'up' as const } }
        } catch (error: unknown) {
            const reason = getByPath(error, 'message', String(error))
            return { [key]: { reason, status: 'down' as const } }
        }
    }
}

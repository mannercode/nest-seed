import type Redis from 'ioredis'
import { createTestContext } from '@mannercode/testing'
import { HealthIndicatorService } from '@nestjs/terminus'
import { getRedisConnectionToken, RedisModule } from '../../redis'
import { RedisHealthIndicator } from '../redis.health-indicator'

export type RedisHealthIndicatorFixture = {
    redis: Redis
    redisIndicator: RedisHealthIndicator
    teardown: () => Promise<void>
}

export async function createRedisHealthIndicatorFixture() {
    const { close, module } = await createTestContext({
        imports: [RedisModule.forRoot({ type: 'single', url: process.env.TESTLIB_REDIS_URL })],
        providers: [RedisHealthIndicator, HealthIndicatorService]
    })

    const redisIndicator = module.get(RedisHealthIndicator)
    const redis = module.get(getRedisConnectionToken())

    const teardown = async () => {
        await close()
    }

    return { redis, redisIndicator, teardown }
}

import { HealthIndicatorService } from '@nestjs/terminus'
import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { RedisHealthIndicator } from 'common'
import { createTestContext, getRedisTestConnection } from 'testlib'
import type Redis from 'ioredis'

export type RedisHealthIndicatorFixture = {
    teardown: () => Promise<void>
    redisIndicator: RedisHealthIndicator
    redis: Redis
}

export async function createRedisHealthIndicatorFixture() {
    const { module, close } = await createTestContext({
        imports: [RedisModule.forRoot({ type: 'single', url: getRedisTestConnection() })],
        providers: [RedisHealthIndicator, HealthIndicatorService]
    })

    const redisIndicator = module.get(RedisHealthIndicator)
    const redis = module.get(getRedisConnectionToken())

    const teardown = async () => {
        await close()
        await redis.quit()
    }

    return { redisIndicator, teardown, redis }
}

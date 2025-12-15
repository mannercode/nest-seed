import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { HealthIndicatorService } from '@nestjs/terminus'
import { RedisHealthIndicator } from 'common'
import Redis from 'ioredis'
import { createTestContext, getRedisTestConnection } from 'testlib'

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

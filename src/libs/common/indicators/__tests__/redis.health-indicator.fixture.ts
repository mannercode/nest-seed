import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { HealthIndicatorService } from '@nestjs/terminus'
import { RedisHealthIndicator } from 'common'
import Redis from 'ioredis'
import { createTestingModule, getRedisTestConnection } from 'testlib'

export type RedisHealthIndicatorFixture = {
    teardown: () => Promise<void>
    redisIndicator: RedisHealthIndicator
    redis: Redis
}

export async function createRedisHealthIndicatorFixture() {
    const module = await createTestingModule({
        imports: [RedisModule.forRoot({ type: 'single', url: getRedisTestConnection() })],
        providers: [RedisHealthIndicator, HealthIndicatorService]
    })

    const redisIndicator = module.get(RedisHealthIndicator)
    const redis = module.get(getRedisConnectionToken())

    async function teardown() {
        await module.close()
        await redis.quit()
    }

    return { redisIndicator, teardown, redis }
}

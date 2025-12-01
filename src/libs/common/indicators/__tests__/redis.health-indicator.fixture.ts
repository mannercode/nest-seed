import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { HealthIndicatorService } from '@nestjs/terminus'
import { RedisHealthIndicator } from 'common'
import Redis from 'ioredis'
import { createTestingModule, getRedisTestConnection } from 'testlib'

export type Fixture = {
    teardown: () => Promise<void>
    redisIndicator: RedisHealthIndicator
    redis: Redis
}

export async function createFixture() {
    const { nodes, password } = getRedisTestConnection()

    const module = await createTestingModule({
        imports: [
            RedisModule.forRoot({ type: 'cluster', nodes, options: { redisOptions: { password } } })
        ],
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

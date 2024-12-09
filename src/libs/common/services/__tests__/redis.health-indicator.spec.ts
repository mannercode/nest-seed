import { TestingModule } from '@nestjs/testing'
import { CacheModule, generateShortId, RedisHealthIndicator, RedisModule } from 'common'
import Redis from 'ioredis'
import { createTestingModule, getRedisTestConnection } from 'testlib'

describe('RedisHealthIndicator', () => {
    let module: TestingModule
    let redisIndicator: RedisHealthIndicator
    let redis: Redis

    beforeEach(async () => {
        const redisCtx = getRedisTestConnection()

        module = await createTestingModule({
            imports: [
                RedisModule.forRootAsync({ useFactory: () => redisCtx }, 'redis'),
                CacheModule.register({
                    name: 'name',
                    redisName: 'redis',
                    useFactory: async (redis: Redis) => ({
                        prefix: generateShortId(),
                        connection: redis
                    })
                })
            ],
            providers: [RedisHealthIndicator]
        })

        redisIndicator = module.get(RedisHealthIndicator)
        redis = module.get(RedisModule.getToken('redis'))
    })

    afterEach(async () => {
        if (module) await module.close()
    })

    it('sets a value in the cache', async () => {
        const res = await redisIndicator.pingCheck('key', redis)

        expect(res).toEqual({ key: { status: 'up' } })
    })
})

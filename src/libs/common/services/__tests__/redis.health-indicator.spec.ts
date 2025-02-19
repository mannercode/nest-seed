import { TestingModule } from '@nestjs/testing'
import { CacheModule, RedisHealthIndicator, RedisModule } from 'common'
import Redis from 'ioredis'
import { createTestingModule, getRedisTestConnection, withTestId } from 'testlib'

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
                    useFactory: () => ({ prefix: withTestId('redis-health') })
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

    it('should return status "up" when Redis is healthy', async () => {
        const res = await redisIndicator.pingCheck('key', redis)

        expect(res).toEqual({ key: { status: 'up' } })
    })
})

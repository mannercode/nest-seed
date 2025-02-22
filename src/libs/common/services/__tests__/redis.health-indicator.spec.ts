import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { HealthIndicatorService } from '@nestjs/terminus'
import { TestingModule } from '@nestjs/testing'
import { CacheModule, RedisHealthIndicator } from 'common'
import Redis from 'ioredis'
import { createTestingModule, getRedisTestConnection, withTestId } from 'testlib'

describe('RedisHealthIndicator', () => {
    let module: TestingModule
    let redisIndicator: RedisHealthIndicator
    let redis: Redis

    beforeEach(async () => {
        const { nodes, password } = getRedisTestConnection()

        module = await createTestingModule({
            imports: [
                RedisModule.forRoot(
                    { type: 'cluster', nodes, options: { redisOptions: { password } } },
                    'redis'
                ),
                CacheModule.register({
                    name: 'name',
                    redisName: 'redis',
                    prefix: withTestId('redis-health')
                })
            ],
            providers: [RedisHealthIndicator, HealthIndicatorService]
        })

        redisIndicator = module.get(RedisHealthIndicator)
        redis = module.get(getRedisConnectionToken('redis'))
    })

    afterEach(async () => {
        await module?.close()
        await redis.quit()
    })

    it('Redis가 정상일 때 상태가 "up"이어야 한다', async () => {
        const res = await redisIndicator.isHealthy('key', redis)

        expect(res).toEqual({ key: { status: 'up' } })
    })
})

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

    it('Redis ping 응답이 "PONG"이 아니면 상태가 "down"이어야 한다', async () => {
        jest.spyOn(redis, 'ping').mockResolvedValueOnce('INVALID_RESPONSE')

        const res = await redisIndicator.isHealthy('key', redis)
        expect(res).toEqual({ key: { status: 'down', reason: 'Redis ping failed' } })
    })

    it('Redis 연결에 실패하면 상태가 "down"이어야 한다', async () => {
        jest.spyOn(redis, 'ping').mockRejectedValueOnce(new Error('Connection timeout'))

        const res = await redisIndicator.isHealthy('key', redis)
        expect(res).toEqual({ key: { status: 'down', reason: 'Connection timeout' } })
    })

    it('예외 발생 시 message가 없으면 지정된 메시지를 반환해야 한다', async () => {
        jest.spyOn(redis, 'ping').mockRejectedValueOnce('unknown error')

        const res = await redisIndicator.isHealthy('key', redis)
        expect(res).toEqual({ key: { status: 'down', reason: 'RedisHealthIndicator failed' } })
    })
})

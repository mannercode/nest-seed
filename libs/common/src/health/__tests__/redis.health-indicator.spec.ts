import type { RedisHealthIndicatorFixture } from './redis.health-indicator.fixture'

describe('RedisHealthIndicator', () => {
    let fix: RedisHealthIndicatorFixture

    beforeEach(async () => {
        const { createRedisHealthIndicatorFixture } =
            await import('./redis.health-indicator.fixture')
        fix = await createRedisHealthIndicatorFixture()
    })
    afterEach(() => fix.teardown())

    describe('isHealthy', () => {
        it('ping 응답이 "PONG"이면 up 상태를 반환한다', async () => {
            const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
            expect(healthStatus).toEqual({ key: { status: 'up' } })
        })

        it('ping이 Error를 던지면 메시지와 함께 down 상태를 반환한다', async () => {
            jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce(new Error('error'))

            const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
            expect(healthStatus).toEqual({ key: { reason: 'error', status: 'down' } })
        })

        it('ping이 Error가 아닌 값을 던지면 원시 값을 reason으로 반환한다', async () => {
            jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce('unknown error')

            const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
            expect(healthStatus).toEqual({ key: { reason: 'unknown error', status: 'down' } })
        })

        it.todo('메시지가 없는 Error는 Error 값 자체를 reason으로 기록한다')
    })
})

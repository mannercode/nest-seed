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
        // ping 응답이 "PONG"일 때
        describe('when the ping response is "PONG"', () => {
            // up 상태를 반환한다
            it('returns an up status', async () => {
                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { status: 'up' } })
            })
        })

        // Error가 발생할 때
        describe('when an Error is thrown', () => {
            beforeEach(() => {
                jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce(new Error('error'))
            })

            // 오류 메시지와 함께 down 상태를 반환한다
            it('returns a down status with the error message', async () => {
                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { reason: 'error', status: 'down' } })
            })
        })

        // Error가 아닌 값이 발생할 때
        describe('when a non-Error is thrown', () => {
            beforeEach(() => {
                jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce('unknown error')
            })

            // 원시 오류를 reason으로 반환한다
            it('returns the raw error as the reason', async () => {
                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { reason: 'unknown error', status: 'down' } })
            })
        })
    })
})

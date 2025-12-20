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
        describe('when the ping response is "PONG"', () => {
            it('returns an up status', async () => {
                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { status: 'up' } })
            })
        })

        describe('when an Error is thrown', () => {
            it('returns a down status with the error message', async () => {
                jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce(new Error('error'))

                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { status: 'down', reason: 'error' } })
            })
        })

        describe('when a non-Error is thrown', () => {
            it('returns the raw error as the reason', async () => {
                jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce('unknown error')

                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { status: 'down', reason: 'unknown error' } })
            })
        })
    })
})

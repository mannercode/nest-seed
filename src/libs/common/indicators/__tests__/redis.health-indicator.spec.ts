import type { RedisHealthIndicatorFixture } from './redis.health-indicator.fixture'

describe('RedisHealthIndicator', () => {
    let fix: RedisHealthIndicatorFixture

    beforeEach(async () => {
        const { createRedisHealthIndicatorFixture } =
            await import('./redis.health-indicator.fixture')
        fix = await createRedisHealthIndicatorFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('isHealthy', () => {
        it('returns an up status when the ping response is "PONG"', async () => {
            const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
            expect(healthStatus).toEqual({ key: { status: 'up' } })
        })

        it('returns down status with a reason when the ping response is not "PONG"', async () => {
            jest.spyOn(fix.redis, 'ping').mockResolvedValueOnce('INVALID_RESPONSE')

            const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
            expect(healthStatus).toEqual({
                key: {
                    status: 'down',
                    reason: 'Redis ping returned unexpected response: INVALID_RESPONSE'
                }
            })
        })

        it('returns down status with the error message when an exception occurs', async () => {
            jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce(new Error('error'))

            const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
            expect(healthStatus).toEqual({ key: { status: 'down', reason: 'error' } })
        })

        it('returns the raw error as the reason when the error has no message', async () => {
            jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce('unknown error')

            const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
            expect(healthStatus).toEqual({ key: { status: 'down', reason: 'unknown error' } })
        })
    })
})

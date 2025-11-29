import type { Fixture } from './redis.health-indicator.fixture'

describe('RedisHealthIndicator', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./redis.health-indicator.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('isHealthy', () => {
        describe('when the ping response is "PONG"', () => {
            it('returns an up status', async () => {
                const healthStatus = await fixture.redisIndicator.isHealthy('key', fixture.redis)
                expect(healthStatus).toEqual({ key: { status: 'up' } })
            })
        })

        describe('when the ping response is not "PONG"', () => {
            it('returns down status with a reason', async () => {
                jest.spyOn(fixture.redis, 'ping').mockResolvedValueOnce('INVALID_RESPONSE')

                const healthStatus = await fixture.redisIndicator.isHealthy('key', fixture.redis)
                expect(healthStatus).toEqual({
                    key: {
                        status: 'down',
                        reason: 'Redis ping returned unexpected response: INVALID_RESPONSE'
                    }
                })
            })
        })

        describe('when an exception occurs', () => {
            it('returns down status with the error message', async () => {
                jest.spyOn(fixture.redis, 'ping').mockRejectedValueOnce(new Error('error'))

                const healthStatus = await fixture.redisIndicator.isHealthy('key', fixture.redis)
                expect(healthStatus).toEqual({ key: { status: 'down', reason: 'error' } })
            })
        })

        describe('when the error has no message', () => {
            it('returns the raw error as the reason', async () => {
                jest.spyOn(fixture.redis, 'ping').mockRejectedValueOnce('unknown error')

                const healthStatus = await fixture.redisIndicator.isHealthy('key', fixture.redis)
                expect(healthStatus).toEqual({ key: { status: 'down', reason: 'unknown error' } })
            })
        })
    })
})

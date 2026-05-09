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
        describe('ping 응답이 "PONG"일 때', () => {
            it('up 상태를 반환한다', async () => {
                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { status: 'up' } })
            })
        })

        describe('Error가 발생할 때', () => {
            beforeEach(() => {
                jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce(new Error('error'))
            })

            it('오류 메시지와 함께 down 상태를 반환한다', async () => {
                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { reason: 'error', status: 'down' } })
            })
        })

        describe('Error가 아닌 값이 발생할 때', () => {
            beforeEach(() => {
                jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce('unknown error')
            })

            it('원시 오류를 reason으로 반환한다', async () => {
                const healthStatus = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(healthStatus).toEqual({ key: { reason: 'unknown error', status: 'down' } })
            })

            it.todo('error.message 가 없으면 error 자체를 reason 으로 기록한다')
        })
    })
})

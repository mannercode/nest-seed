import type { Fixture } from './redis.health-indicator.fixture'

describe('RedisHealthIndicator', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./redis.health-indicator.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('isHealthy', () => {
        // ping 응답이 'PONG'인 경우
        describe('when ping response is "PONG"', () => {
            // up 상태를 반환한다
            it('returns an up status', async () => {
                const res = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(res).toEqual({ key: { status: 'up' } })
            })
        })

        // ping 응답이 'PONG'이 아닌 경우
        describe('when ping response is not "PONG"', () => {
            // down 상태와 사유를 반환한다
            it('returns down status with a reason', async () => {
                jest.spyOn(fix.redis, 'ping').mockResolvedValueOnce('INVALID_RESPONSE')

                const res = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(res).toEqual({
                    key: {
                        status: 'down',
                        reason: 'Redis ping returned unexpected response: INVALID_RESPONSE'
                    }
                })
            })
        })

        // 예외가 발생하는 경우
        describe('when an exception occurs', () => {
            // down 상태와 에러 메시지를 반환한다
            it('returns down status with the error message', async () => {
                jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce(new Error('error'))

                const res = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(res).toEqual({ key: { status: 'down', reason: 'error' } })
            })
        })

        // 예외 메시지가 없는 경우
        describe('when the error has no message', () => {
            // 원본 에러를 사유로 반환한다
            it('returns the raw error as the reason', async () => {
                jest.spyOn(fix.redis, 'ping').mockRejectedValueOnce('unknown error')

                const res = await fix.redisIndicator.isHealthy('key', fix.redis)
                expect(res).toEqual({ key: { status: 'down', reason: 'unknown error' } })
            })
        })
    })
})

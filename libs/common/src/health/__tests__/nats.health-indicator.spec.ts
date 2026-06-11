import type { NatsHealthIndicatorFixture } from './nats.health-indicator.fixture'

describe('NatsHealthIndicator', () => {
    let fix: NatsHealthIndicatorFixture

    beforeEach(async () => {
        const { createNatsHealthIndicatorFixture } = await import('./nats.health-indicator.fixture')
        fix = await createNatsHealthIndicatorFixture()
    })
    afterEach(() => fix.teardown())

    describe('isHealthy', () => {
        it('flush가 성공하면 up 상태를 반환한다', async () => {
            const healthStatus = await fix.natsIndicator.isHealthy('key', fix.connection)
            expect(healthStatus).toEqual({ key: { status: 'up' } })
        })

        it('flush가 실패하면 메시지와 함께 down 상태를 반환한다', async () => {
            jest.spyOn(fix.connection, 'flush').mockRejectedValueOnce(new Error('error'))

            const healthStatus = await fix.natsIndicator.isHealthy('key', fix.connection)
            expect(healthStatus).toEqual({ key: { reason: 'error', status: 'down' } })
        })
    })
})

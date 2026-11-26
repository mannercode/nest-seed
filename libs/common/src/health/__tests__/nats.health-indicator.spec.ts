import {
    type NatsHealthIndicatorFixture,
    createNatsHealthIndicatorFixture
} from './nats.health-indicator.fixture.js'

describe('NatsHealthIndicator', () => {
    let fix: NatsHealthIndicatorFixture

    beforeEach(async () => {
        fix = await createNatsHealthIndicatorFixture()
    })
    afterEach(() => fix.teardown())

    describe('isHealthy', () => {
        it('up을 반환한다', async () => {
            const healthStatus = await fix.natsIndicator.isHealthy('key', fix.connection)
            expect(healthStatus).toEqual({ key: { status: 'up' } })
        })

        describe('NATS flush가 실패하면', () => {
            beforeEach(() => {
                vi.spyOn(fix.connection, 'flush').mockRejectedValueOnce(new Error('error'))
            })
            it('오류 메시지와 down 상태를 반환한다', async () => {
                const healthStatus = await fix.natsIndicator.isHealthy('key', fix.connection)
                expect(healthStatus).toEqual({ key: { reason: 'error', status: 'down' } })
            })
        })
    })
})

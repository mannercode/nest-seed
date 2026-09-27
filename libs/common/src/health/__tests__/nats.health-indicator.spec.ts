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
        it('상태를 조회하면 up 상태를 반환한다', async () => {
            const healthStatus = await fix.natsIndicator.isHealthy('key', fix.connection)
            expect(healthStatus).toEqual({ key: { status: 'up' } })
        })

        describe('NATS flush가 실패하도록 설정하면', () => {
            beforeEach(() => {
                vi.spyOn(fix.connection, 'flush').mockRejectedValueOnce(new Error('error'))
            })
            it('상태 조회 시 오류 메시지와 down 상태를 반환한다', async () => {
                const healthStatus = await fix.natsIndicator.isHealthy('key', fix.connection)
                expect(healthStatus).toEqual({ key: { reason: 'error', status: 'down' } })
            })
        })
    })
})

import type { TemporalHealthIndicatorFixture } from './temporal.health-indicator.fixture'

describe('TemporalHealthIndicator', () => {
    let fix: TemporalHealthIndicatorFixture

    beforeEach(async () => {
        const { createTemporalHealthIndicatorFixture } =
            await import('./temporal.health-indicator.fixture')
        fix = await createTemporalHealthIndicatorFixture()
    })
    afterEach(() => fix.teardown())

    describe('isHealthy', () => {
        it('gRPC health check가 SERVING이면 up 상태를 반환한다', async () => {
            const healthStatus = await fix.temporalIndicator.isHealthy('key', fix.connection)
            expect(healthStatus).toEqual({ key: { status: 'up' } })
        })

        it('SERVING이 아닌 상태면 servingStatus와 함께 down 상태를 반환한다', async () => {
            jest.spyOn(fix.connection.healthService, 'check').mockResolvedValueOnce({
                status: 2
            } as any)

            const healthStatus = await fix.temporalIndicator.isHealthy('key', fix.connection)
            expect(healthStatus).toEqual({ key: { servingStatus: '2', status: 'down' } })
        })

        it('health check가 실패하면 메시지와 함께 down 상태를 반환한다', async () => {
            jest.spyOn(fix.connection.healthService, 'check').mockRejectedValueOnce(
                new Error('error')
            )

            const healthStatus = await fix.temporalIndicator.isHealthy('key', fix.connection)
            expect(healthStatus).toEqual({ key: { reason: 'error', status: 'down' } })
        })
    })
})

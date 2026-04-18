import type { TemporalWorkerServiceFixture } from './temporal-worker.service.fixture'

describe('TemporalWorkerService', () => {
    let fix: TemporalWorkerServiceFixture
    let closeSpy: jest.SpyInstance

    beforeEach(async () => {
        const { NativeConnection } = await import('@temporalio/worker')
        const originalConnect = NativeConnection.connect.bind(NativeConnection)

        jest.spyOn(NativeConnection, 'connect').mockImplementation(async (opts) => {
            const real = await originalConnect(opts)
            closeSpy = jest.spyOn(real, 'close')
            return real
        })

        const { createTemporalWorkerServiceFixture } =
            await import('./temporal-worker.service.fixture')
        fix = await createTemporalWorkerServiceFixture()
    })
    afterEach(() => fix.teardown())

    // Worker가 초기화된다
    it('initializes the worker on module init', () => {
        expect(fix.service).toBeDefined()
    })

    // 모듈 종료 시 NativeConnection 을 닫는다
    it('closes the NativeConnection on module destroy', async () => {
        expect(closeSpy).not.toHaveBeenCalled()

        await fix.teardown()
        fix.teardown = async () => {}

        expect(closeSpy).toHaveBeenCalled()
    })
})

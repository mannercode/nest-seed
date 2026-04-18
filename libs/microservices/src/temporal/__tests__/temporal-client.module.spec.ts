import type { TemporalClientModuleFixture } from './temporal-client.module.fixture'

describe('TemporalClientModule', () => {
    let fix: TemporalClientModuleFixture
    let closeSpy: jest.SpyInstance

    beforeEach(async () => {
        const { Connection } = await import('@temporalio/client')
        const originalConnect = Connection.connect.bind(Connection)

        jest.spyOn(Connection, 'connect').mockImplementation(async (opts) => {
            const real = await originalConnect(opts)
            closeSpy = jest.spyOn(real, 'close')
            return real
        })

        const { createTemporalClientModuleFixture } =
            await import('./temporal-client.module.fixture')
        fix = await createTemporalClientModuleFixture()
    })
    afterEach(() => fix.teardown())

    // registerAsync로 Temporal Client를 생성한다
    it('creates a Temporal Client via registerAsync', () => {
        expect(fix.client).toBeDefined()
        expect(fix.client.workflow).toBeDefined()
    })

    // 모듈 종료 시 Connection 을 닫는다
    it('closes the Connection on module destroy', async () => {
        expect(closeSpy).not.toHaveBeenCalled()

        await fix.teardown()
        fix.teardown = async () => {}

        expect(closeSpy).toHaveBeenCalled()
    })
})

import type { TemporalClientModuleFixture } from './temporal-client.module.fixture'

describe('TemporalClientModule', () => {
    let fix: TemporalClientModuleFixture

    beforeEach(async () => {
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
})

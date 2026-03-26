import type { TemporalWorkerServiceFixture } from './temporal-worker.service.fixture'

describe('TemporalWorkerService', () => {
    let fix: TemporalWorkerServiceFixture

    beforeEach(async () => {
        const { createTemporalWorkerServiceFixture } =
            await import('./temporal-worker.service.fixture')
        fix = await createTemporalWorkerServiceFixture()
    })
    afterEach(() => fix.teardown())

    // Worker가 초기화된다
    it('initializes the worker on module init', () => {
        expect(fix.service).toBeDefined()
    })
})

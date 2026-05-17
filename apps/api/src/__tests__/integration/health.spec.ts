import type { AppTestContext } from './helpers'

describe('Health', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        const { createAppTestContext } = await import('./helpers')
        fix = await createAppTestContext()
    })

    afterEach(() => fix.teardown())

    it('GET /health → 200 (mongo+redis up)', async () => {
        const { body } = await fix.httpClient.get('/health').ok()

        expect(body).toEqual({
            status: 'ok',
            info: { mongodb: { status: 'up' }, redis: { status: 'up' } },
            error: {},
            details: { mongodb: { status: 'up' }, redis: { status: 'up' } }
        })
    })
})

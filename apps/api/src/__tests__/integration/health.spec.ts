import type { AppTestContext } from './helpers'

describe('Health', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        const { createAppTestContext } = await import('./helpers')
        fix = await createAppTestContext()
    })

    afterEach(() => fix.teardown())

    it('mongo와 redis가 정상이면 200과 상태 정보를 반환한다', async () => {
        const { body } = await fix.httpClient.get('/health').ok()

        expect(body).toEqual({
            status: 'ok',
            info: { mongodb: { status: 'up' }, redis: { status: 'up' } },
            error: {},
            details: { mongodb: { status: 'up' }, redis: { status: 'up' } }
        })
    })
})

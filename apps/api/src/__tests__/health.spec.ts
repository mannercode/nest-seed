import type { AppTestContext } from './helpers'

describe('Health', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        const { createAppTestContext } = await import('./helpers')
        fix = await createAppTestContext()
    })

    afterEach(() => fix.teardown())

    describe('GET /health', () => {
        it('mongo·redis·nats·temporal이 정상이면 200과 상태 정보를 반환한다', async () => {
            const { body } = await fix.httpClient.get('/health').ok()

            const allUp = {
                mongodb: { status: 'up' },
                redis: { status: 'up' },
                nats: { status: 'up' },
                temporal: { status: 'up' }
            }
            expect(body).toEqual({ status: 'ok', info: allUp, error: {}, details: allUp })
        })
    })
})

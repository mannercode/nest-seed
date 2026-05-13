import type { TestContextFixture } from './create-test-context.fixture'

describe('createTestContext', () => {
    let fix: TestContextFixture

    beforeEach(async () => {
        const { createTestContextFixture } = await import('./create-test-context.fixture')
        fix = await createTestContextFixture()
    })
    afterEach(() => fix.teardown())

    it('대체 지정한 제공자는 mock 서비스로 바뀐다', async () => {
        const message = fix.sampleService.getMessage()
        expect(message).toEqual({ message: 'This is Mock' })
    })

    it('HTTP 라우팅이 컨텍스트를 통해 정상 동작한다', async () => {
        await fix.httpClient.get('/message/value').ok({ received: 'value' })
    })
})

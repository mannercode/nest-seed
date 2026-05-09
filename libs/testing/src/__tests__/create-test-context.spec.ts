import type { TestContextFixture } from './create-test-context.fixture'

describe('createTestContext', () => {
    let fix: TestContextFixture

    beforeEach(async () => {
        const { createTestContextFixture } = await import('./create-test-context.fixture')
        fix = await createTestContextFixture()
    })
    afterEach(() => fix.teardown())

    it('프로바이더가 오버라이드되면 목 서비스가 사용된다', async () => {
        const message = fix.sampleService.getMessage()
        expect(message).toEqual({ message: 'This is Mock' })
    })

    it('HTTP 메시지에 올바르게 응답한다', async () => {
        await fix.httpClient.get('/message/value').ok({ received: 'value' })
    })
})

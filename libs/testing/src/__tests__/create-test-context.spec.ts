import type { TestContextFixture } from './create-test-context.fixture'

describe('createTestContext', () => {
    let fix: TestContextFixture

    beforeEach(async () => {
        const { createTestContextFixture } = await import('./create-test-context.fixture')
        fix = await createTestContextFixture()
    })
    afterEach(() => fix.teardown())

    it('override로 지정한 제공자가 모의 서비스로 교체된다', async () => {
        const message = fix.sampleService.getMessage()
        expect(message).toEqual({ message: 'This is Mock' })
    })

    it('테스트 컨텍스트의 httpClient로 GET 요청을 보내면 라우팅된 응답을 반환한다', async () => {
        await fix.httpClient.get('/message/value').ok({ received: 'value' })
    })
})

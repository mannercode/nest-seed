import type { TestContextFixture } from './create-test-context.fixture'
import { withTestId } from '../utils'

describe('createTestContext', () => {
    let fix: TestContextFixture

    beforeEach(async () => {
        const { createTestContextFixture } = await import('./create-test-context.fixture')
        fix = await createTestContextFixture()
    })
    afterEach(() => fix.teardown())

    // 프로바이더가 오버라이드되면 목 서비스가 사용된다
    it('uses the mocked service when the provider is overridden', async () => {
        const message = fix.sampleService.getMessage()
        expect(message).toEqual({ message: 'This is Mock' })
    })

    // RPC 메시지에 올바르게 응답한다
    it('responds correctly to an RPC message', async () => {
        await fix.rpcClient.expectRequest(
            withTestId('getRpcMessage'),
            { arg: 'value' },
            { id: 'value' }
        )
    })

    // HTTP 메시지에 올바르게 응답한다
    it('responds correctly to an HTTP message', async () => {
        await fix.httpClient.get('/message/value').ok({ received: 'value' })
    })
})

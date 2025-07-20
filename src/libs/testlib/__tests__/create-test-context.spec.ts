import { withTestId } from 'testlib'
import type { Fixture } from './create-test-context.fixture'

describe('createTestContext()', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./create-test-context.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    // RPC 메시지를 전송할 때
    describe('when sending an RPC message', () => {
        // 올바르게 응답한다.
        it('responds correctly', async () => {
            await fix.rpcClient.expect(
                withTestId('getRpcMessage'),
                { arg: 'value' },
                { id: 'value' }
            )
        })
    })

    // HTTP 메시지를 전송할 때
    describe('when sending an HTTP message', () => {
        // 올바르게 응답한다.
        it('responds correctly', async () => {
            await fix.httpClient.get('/message/value').ok({ received: 'value' })
        })
    })
})

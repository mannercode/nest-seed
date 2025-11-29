import { withTestId } from 'testlib'
import type { Fixture } from './create-test-context.fixture'

describe('createTestContext', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./create-test-context.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('when sending an RPC message', () => {
        it('responds correctly', async () => {
            await fixture.rpcClient.expect(
                withTestId('getRpcMessage'),
                { arg: 'value' },
                { id: 'value' }
            )
        })
    })

    describe('when sending an HTTP message', () => {
        it('responds correctly', async () => {
            await fixture.httpClient.get('/message/value').ok({ received: 'value' })
        })
    })
})

import { withTestId } from 'testlib'
import type { TestContextFixture } from './create-test-context.fixture'

describe('createTestContext', () => {
    let fixture: TestContextFixture

    beforeEach(async () => {
        const { createTestContextFixture } = await import('./create-test-context.fixture')
        fixture = await createTestContextFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('when a service is mocked via overrideProviders', () => {
        it('uses the mocked service', async () => {
            const message = fixture.sampleService.getMessage()
            expect(message).toEqual({ message: 'This is Mock' })
        })
    })

    it('responds correctly to an RPC message', async () => {
        await fixture.rpcClient.expect(
            withTestId('getRpcMessage'),
            { arg: 'value' },
            { id: 'value' }
        )
    })

    it('responds correctly to an HTTP message', async () => {
        await fixture.httpClient.get('/message/value').ok({ received: 'value' })
    })
})

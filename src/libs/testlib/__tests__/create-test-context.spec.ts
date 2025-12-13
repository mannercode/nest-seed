import { withTestId } from 'testlib'
import type { TestContextFixture } from './create-test-context.fixture'

describe('createTestContext', () => {
    let fix: TestContextFixture

    beforeEach(async () => {
        const { createTestContextFixture } = await import('./create-test-context.fixture')
        fix = await createTestContextFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('when a service is mocked via overrideProviders', () => {
        it('uses the mocked service', async () => {
            const message = fix.sampleService.getMessage()
            expect(message).toEqual({ message: 'This is Mock' })
        })
    })

    it('responds correctly to an RPC message', async () => {
        await fix.rpcClient.expect(withTestId('getRpcMessage'), { arg: 'value' }, { id: 'value' })
    })

    it('responds correctly to an HTTP message', async () => {
        await fix.httpClient.get('/message/value').ok({ received: 'value' })
    })
})

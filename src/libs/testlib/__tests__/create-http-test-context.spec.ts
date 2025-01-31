import { HttpTestClient, HttpTestContext, createHttpTestContext } from '..'
import { SampleModule } from './create-http-test-context.fixture'

describe('createHttpTestContext', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient

    beforeEach(async () => {
        testContext = await createHttpTestContext({ imports: [SampleModule] })
        client = testContext.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('메시지를 전송하면 응답해야 한다', async () => {
        const res = await client.get('/message/value').ok()

        expect(res.body).toEqual({ received: 'value' })
    })
})

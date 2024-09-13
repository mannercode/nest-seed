import { createHttpTestContext, HttpTestClient, HttpTestContext } from 'testlib'
import { AppModule } from './server-sent-events.service.fixture'

describe('createHttpTestContext', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient

    beforeEach(async () => {
        testContext = await createHttpTestContext({
            imports: [AppModule]
        })
        client = testContext.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('should return mock message', async () => {
        const promise = new Promise((resolve, reject) => {
            client.get('/sse/events').sse((value) => {
                resolve(value)
            }, reject)
        })

        await client.post('/sse/trigger-event').body({ message: 'text message' }).created()

        const events = await promise
        expect(events).toEqual('text message')
    })
})

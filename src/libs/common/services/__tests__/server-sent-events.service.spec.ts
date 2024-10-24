import { createHttpTestContext, HttpTestClient, HttpTestContext } from 'testlib'
import { ServerSentEventsService } from '../server-sent-events.service'
import { SseController } from './server-sent-events.service.fixture'

describe('ServerSentEventsService', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient

    beforeEach(async () => {
        testContext = await createHttpTestContext({
            controllers: [SseController],
            providers: [ServerSentEventsService]
        })
        client = testContext.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('SSE를 모니터링 해야 한다', async () => {
        const promise = new Promise((resolve, reject) => {
            client.get('/sse/events').sse((value) => {
                return resolve(value)
            }, reject)
        })

        await client.post('/sse/trigger-event').body({ message: 'text message' }).created()

        await expect(promise).resolves.toEqual('text message')
    })
})

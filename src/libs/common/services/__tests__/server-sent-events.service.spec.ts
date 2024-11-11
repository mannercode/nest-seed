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
        console.log('SSE 4')
        const promise = new Promise((resolve, reject) => {
            console.log('SSE 5')
            client.get('/sse/events').sse((value) => {
                console.log('SSE 6')
                return resolve(value)
            }, reject)
        })

        console.log('SSE 7')

        await client.post('/sse/trigger-event').body({ message: 'text message' }).created()

        console.log('SSE 8')
        await expect(promise).resolves.toEqual('text message')
        console.log('SSE 9')
    })
})

// 4 5 7 2 3 8 1
// 4 5 7 1 2 3 6 8 9

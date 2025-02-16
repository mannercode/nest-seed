import { Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import { createNatsContainers, createTestContext, HttpTestClient, TestContext } from 'testlib'
import { HttpController } from './client-proxy.service.fixture'

describe('ClientProxyService', () => {
    let context: TestContext
    let client: HttpTestClient
    let closeNats: () => Promise<void>

    beforeEach(async () => {
        const { servers, close } = await createNatsContainers()
        closeNats = close

        const natsOpts = { transport: Transport.NATS, options: { servers } } as const

        context = await createTestContext({
            metadata: {
                imports: [
                    ClientProxyModule.registerAsync({
                        name: 'name',
                        useFactory: () => natsOpts
                    })
                ],
                controllers: [HttpController]
            },
            configureApp: async (app) => {
                app.connectMicroservice(natsOpts, { inheritAppConfig: true })
                await app.startAllMicroservices()
            }
        })

        client = new HttpTestClient(`http://localhost:${context.httpPort}`)
    })

    afterEach(async () => {
        await context?.close()
        await closeNats?.()
    })

    it('HttpController는 Observable로 응답할 수 있다', async () => {
        const result = await client.get('/observable').ok()
        expect(result.body).toEqual({ result: 'success' })
    })

    it('Observable의 값을 읽어서 반환할 수 있다', async () => {
        const result = await client.get('/value').ok()
        expect(result.body).toEqual({ result: 'success' })
    })

    it('Microservice 이벤트를 전송해야 한다', async () => {
        const promise = new Promise((resolve, reject) => {
            client.get('/handle-event').sse((value) => resolve(value), reject)
        })

        await client.get('/emit-event').ok()
        await expect(promise).resolves.toEqual('{"arg":"value"}')
    })
})

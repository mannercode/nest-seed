import { Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import { createTestContext, getNatsTestConnection, HttpTestClient, TestContext } from 'testlib'
import { HttpController } from './client-proxy.service.fixture'

describe('ClientProxyService', () => {
    let context: TestContext
    let client: HttpTestClient

    beforeEach(async () => {
        const { servers } = await getNatsTestConnection()
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

    it.skip('메시지는queue 그룹 마다 한 번만 전달되어야 한다', async () => {})
    it.skip('이벤트는 queue 그룹과 상관없이 모든 인스턴스에 전달되어야 한다', async () => {})
})

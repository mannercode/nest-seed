import { Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import {
    createHttpTestContext,
    createMicroserviceTestContext,
    createNatsContainers,
    HttpTestClient,
    HttpTestContext,
    MicroserviceTestContext
} from 'testlib'
import { HttpController, MicroserviceModule } from './client-proxy.service.fixture'

describe('ClientProxyService', () => {
    let microContext: MicroserviceTestContext
    let httpContext: HttpTestContext
    let client: HttpTestClient
    let closeNats: () => Promise<void>

    beforeEach(async () => {
        const { servers, close } = await createNatsContainers()
        closeNats = close

        microContext = await createMicroserviceTestContext({
            metadata: { imports: [MicroserviceModule] },
            nats: { servers }
        })

        httpContext = await createHttpTestContext({
            imports: [
                ClientProxyModule.registerAsync({
                    name: 'name',
                    useFactory: () => ({ transport: Transport.NATS, options: { servers } })
                })
            ],
            controllers: [HttpController]
        })
        client = httpContext.client
    })

    afterEach(async () => {
        await httpContext?.close()
        await microContext?.close()
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
})

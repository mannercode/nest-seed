import { Transport } from '@nestjs/microservices'
import { ClientProxyModule, generateShortId } from 'common'
import {
    createHttpTestContext,
    createMicroserviceTestContext,
    getNatsTestConnection,
    HttpTestClient,
    HttpTestContext,
    MicroserviceTestContext
} from 'testlib'
import { HttpController, MicroserviceModule } from './client-proxy.service.fixture'

describe('ClientProxyService', () => {
    let microContext: MicroserviceTestContext
    let httpContext: HttpTestContext
    let client: HttpTestClient

    beforeEach(async () => {
        microContext = await createMicroserviceTestContext({ imports: [MicroserviceModule] })

        httpContext = await createHttpTestContext({
            imports: [
                ClientProxyModule.registerAsync({
                    name: 'name',
                    tag: () => generateShortId(),
                    useFactory: () => {
                        const { servers } = getNatsTestConnection()
                        return { transport: Transport.NATS, options: { servers } }
                    }
                })
            ],
            controllers: [HttpController]
        })
        client = httpContext.client
    })

    afterEach(async () => {
        await httpContext?.close()
        await microContext?.close()
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

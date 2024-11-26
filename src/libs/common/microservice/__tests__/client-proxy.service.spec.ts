import { Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import {
    HttpTestClient,
    HttpTestContext,
    MicroserviceTestContext,
    createHttpTestContext,
    createMicroserviceTestContext
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
                    name: 'SERVICES',
                    useFactory: () => ({
                        transport: Transport.TCP,
                        options: { host: '0.0.0.0', port: microContext.port }
                    })
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

    it('should return OK(200) when GET /send endpoint is called', async () => {
        const result = await client.get('/send').ok()
        expect(result.body).toEqual({ result: 'success' })
    })

    it('should return OK(200) when GET /get endpoint is called', async () => {
        const result = await client.get('/get').ok()
        expect(result.body).toEqual({ result: 'success' })
    })
})

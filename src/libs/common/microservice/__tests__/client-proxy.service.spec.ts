import { Transport } from '@nestjs/microservices'
import { ClientProxyModule, generateShortId } from 'common'
import {
    HttpTestClient,
    HttpTestContext,
    MicroserviceTestContext,
    createHttpTestContext,
    createMicroserviceTestContext,
    getKafkaTestConnection
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
                    useFactory: () => {
                        const { brokers } = getKafkaTestConnection()

                        return {
                            transport: Transport.KAFKA,
                            options: {
                                client: { brokers },
                                consumer: { groupId: generateShortId(), maxWaitTimeInMs: 0 }
                            }
                        }
                    },
                    messages: ['test.method']
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

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
import { HttpController, messages, MicroserviceModule } from './client-proxy.service.fixture'

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
                    messages: [messages.method]
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

import { Controller, Get } from '@nestjs/common'
import { MessagePattern, NatsOptions, Transport } from '@nestjs/microservices'
import { ClientProxyModule, ClientProxyService, InjectClientProxy } from 'common'
import { createHttpTestContext, getNatsTestConnection, HttpTestClient, withTestId } from 'testlib'

@Controller()
class TestController {
    constructor(@InjectClientProxy('clientName') private readonly client: ClientProxyService) {}

    @MessagePattern(withTestId('method'))
    method() {
        return { result: 'success' }
    }

    @Get('value')
    getValue() {
        return this.client.getJson(withTestId('method'), {})
    }
}

export interface Fixture {
    teardown: () => Promise<void>
    httpClient: HttpTestClient
}

export async function createFixture() {
    const { servers } = getNatsTestConnection()
    const brokerOptions = { transport: Transport.NATS, options: { servers } } as NatsOptions

    const { httpClient, ...testContext } = await createHttpTestContext({
        metadata: {
            imports: [
                ClientProxyModule.registerAsync({
                    name: 'clientName',
                    useFactory() {
                        return brokerOptions
                    }
                })
            ],
            controllers: [TestController]
        },
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    async function teardown() {
        await testContext.close()
    }

    return { teardown, httpClient }
}

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

export type ClientProxyWithNameFixture = {
    teardown: () => Promise<void>
    httpClient: HttpTestClient
}

export async function createClientProxyWithNameFixture() {
    const brokerOptions = {
        transport: Transport.NATS,
        options: getNatsTestConnection()
    } as NatsOptions

    const { httpClient, ...ctx } = await createHttpTestContext({
        imports: [
            ClientProxyModule.registerAsync({
                name: 'clientName',
                useFactory() {
                    return brokerOptions
                }
            })
        ],
        controllers: [TestController],
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    async function teardown() {
        await ctx.close()
    }

    return { teardown, httpClient }
}

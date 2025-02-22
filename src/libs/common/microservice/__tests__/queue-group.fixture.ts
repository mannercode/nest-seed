import { Controller } from '@nestjs/common'
import { MessagePattern, NatsOptions, Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import { createTestContext, getNatsTestConnection, HttpTestClient, withTestId } from 'testlib'

@Controller()
class SendTestController {
    @MessagePattern(withTestId('subject.method'), { queue: 'queue-group' })
    method() {
        return { result: 'success' }
    }
}

export async function createFixture() {
    const { servers } = getNatsTestConnection()
    const brokerOptions = { transport: Transport.NATS, options: { servers } } as NatsOptions

    const testContext = await createTestContext({
        metadata: {
            imports: [
                ClientProxyModule.registerAsync({ name: 'name', useFactory: () => brokerOptions })
            ],
            controllers: [SendTestController]
        },
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const client = new HttpTestClient(testContext.httpPort)

    return { testContext, client }
}

import { Controller } from '@nestjs/common'
import { MessagePattern, NatsOptions, Transport } from '@nestjs/microservices'
import {
    createTestContext,
    getNatsTestConnection,
    MicroserviceTestClient,
    TestContextOptions,
    withTestId
} from 'testlib'

@Controller()
export class MessageController {
    @MessagePattern(withTestId('subject.queue'))
    handleQueueMessage() {
        this.processQueueLogic()

        return { result: 'success' }
    }

    processQueueLogic() {}

    @MessagePattern(withTestId('subject.broadcast'), { queue: false })
    handleBroadcastMessage() {
        this.processBroadcastLogic()

        return { result: 'success' }
    }

    processBroadcastLogic() {}
}

export const numberOfInstance = 10

export async function createFixture() {
    const { servers } = getNatsTestConnection()
    const brokerOptions = {
        transport: Transport.NATS,
        options: { servers, queue: 'queue-group' }
    } as NatsOptions

    const options: TestContextOptions = {
        metadata: { controllers: [MessageController] },
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    }

    const testContexts = await Promise.all(
        Array.from({ length: numberOfInstance }, async () => createTestContext(options))
    )

    const client = MicroserviceTestClient.create(brokerOptions)

    const closeFixture = async () => {
        await client?.close()
        await Promise.all(testContexts.map(async (context) => context.close()))
    }

    return { closeFixture, client, MessageController }
}

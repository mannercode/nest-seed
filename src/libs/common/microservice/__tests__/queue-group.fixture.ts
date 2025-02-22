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

    const testContext1 = await createTestContext(options)
    const testContext2 = await createTestContext(options)

    const client = MicroserviceTestClient.create(brokerOptions)

    const closeFixture = async () => {
        await client?.close()
        await testContext1?.close()
        await testContext2?.close()
    }

    return { closeFixture, client, MessageController }
}

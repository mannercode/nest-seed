import { Controller } from '@nestjs/common'
import { MessagePattern, NatsOptions, Transport } from '@nestjs/microservices'
import {
    createTestContext,
    getNatsTestConnection,
    RpcTestClient,
    TestContextOptions,
    withTestId
} from 'testlib'

@Controller()
export class MessageController {
    @MessagePattern(withTestId('queue'))
    handleQueueMessage() {
        this.processQueueLogic()

        return { result: 'success' }
    }

    processQueueLogic() {}

    @MessagePattern(withTestId('broadcast'), { queue: false })
    handleBroadcastMessage() {
        this.processBroadcastLogic()

        return { result: 'success' }
    }

    processBroadcastLogic() {}
}

export interface Fixture {
    teardown: () => Promise<void>
    rpcClient: RpcTestClient
    numberOfInstance: number
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

    const numberOfInstance = 10

    const testContexts = await Promise.all(
        Array.from({ length: numberOfInstance }, async () => createTestContext(options))
    )

    const rpcClient = RpcTestClient.create(brokerOptions)

    async function teardown() {
        await rpcClient.close()
        await Promise.all(testContexts.map(async (context) => context.close()))
    }

    return { teardown, rpcClient, numberOfInstance }
}

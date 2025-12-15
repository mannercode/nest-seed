import { Controller } from '@nestjs/common'
import { MessagePattern, NatsOptions, Transport } from '@nestjs/microservices'
import { createTestContext, getNatsTestConnection, RpcTestClient, withTestId } from 'testlib'

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

export type QueueGroupFixture = {
    teardown: () => Promise<void>
    rpcClient: RpcTestClient
    numberOfInstance: number
}

export async function createQueueGroupFixture() {
    const brokerOptions = {
        transport: Transport.NATS,
        options: { ...getNatsTestConnection(), queue: 'queue-group' }
    } as NatsOptions

    const numberOfInstance = 10

    const ctxs = await Promise.all(
        Array.from({ length: numberOfInstance }, async () =>
            createTestContext({
                controllers: [MessageController],
                configureApp: async (app) => {
                    app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
                    await app.startAllMicroservices()
                }
            })
        )
    )

    const rpcClient = RpcTestClient.create(brokerOptions)

    async function teardown() {
        await rpcClient.close()
        await Promise.all(ctxs.map(async (ctx) => ctx.close()))
    }

    return { teardown, rpcClient, numberOfInstance }
}

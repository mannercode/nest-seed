import { Controller } from '@nestjs/common'
import { NatsOptions } from '@nestjs/microservices'
import { MessagePattern, Transport } from '@nestjs/microservices'
import { createTestContext, getNatsTestConnection, RpcTestClient, withTestId } from 'testlib'

@Controller()
export class MessageController {
    @MessagePattern(withTestId('broadcast'), { queue: false })
    handleBroadcastMessage() {
        this.processBroadcastLogic()

        return { result: 'success' }
    }

    @MessagePattern(withTestId('queue'))
    handleQueueMessage() {
        this.processQueueLogic()

        return { result: 'success' }
    }

    processBroadcastLogic() {}

    processQueueLogic() {}
}

export type QueueGroupFixture = {
    instanceCount: number
    rpcClient: RpcTestClient
    teardown: () => Promise<void>
}

export async function createQueueGroupFixture() {
    const brokerOptions = {
        options: { ...getNatsTestConnection(), queue: 'queue-group' },
        transport: Transport.NATS
    } as NatsOptions

    const instanceCount = 10

    const ctxs = await Promise.all(
        Array.from({ length: instanceCount }, async () =>
            createTestContext({
                configureApp: async (app) => {
                    app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
                    await app.startAllMicroservices()
                },
                controllers: [MessageController]
            })
        )
    )

    const rpcClient = RpcTestClient.create(brokerOptions)

    const teardown = async () => {
        await rpcClient.close()
        await Promise.all(ctxs.map(async (ctx) => ctx.close()))
    }

    return { instanceCount, rpcClient, teardown }
}

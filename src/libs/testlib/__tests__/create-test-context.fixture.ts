import { Controller, Get, Param } from '@nestjs/common'
import {
    MessagePattern,
    MicroserviceOptions,
    NatsOptions,
    Payload,
    Transport
} from '@nestjs/microservices'
import {
    createHttpTestContext,
    getNatsTestConnection,
    HttpTestClient,
    RpcTestClient,
    withTestId
} from 'testlib'

@Controller()
class SampleController {
    @MessagePattern(withTestId('getRpcMessage'))
    getRpcMessage(@Payload() request: { arg: string }) {
        return { id: request.arg }
    }

    @Get('message/:arg')
    async getHttpMessage(@Param('arg') arg: string) {
        return { received: arg }
    }
}

export type Fixture = {
    teardown: () => Promise<void>
    rpcClient: RpcTestClient
    httpClient: HttpTestClient
}

export async function createFixture(): Promise<Fixture> {
    const { servers } = await getNatsTestConnection()
    const brokerOpts = { transport: Transport.NATS, options: { servers } } as NatsOptions

    const { httpClient, ...testContext } = await createHttpTestContext({
        metadata: { controllers: [SampleController] },
        configureApp: async (app) => {
            app.connectMicroservice<MicroserviceOptions>(brokerOpts, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const rpcClient = RpcTestClient.create(brokerOpts)

    async function teardown() {
        await rpcClient.close()
        await testContext.close()
    }

    return { teardown, rpcClient, httpClient }
}

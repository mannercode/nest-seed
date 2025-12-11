import { Controller, Get, Injectable, Param } from '@nestjs/common'
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

@Injectable()
export class SampleService {
    getMessage() {
        return 'This method should not be called'
    }
}

export type TestContextFixture = {
    teardown: () => Promise<void>
    rpcClient: RpcTestClient
    httpClient: HttpTestClient
    sampleService: SampleService
}

export async function createTestContextFixture(): Promise<TestContextFixture> {
    const brokerOpts = {
        transport: Transport.NATS,
        options: getNatsTestConnection()
    } as NatsOptions

    const { httpClient, ...testContext } = await createHttpTestContext({
        controllers: [SampleController],
        providers: [SampleService],
        overrideProviders: [
            {
                original: SampleService,
                replacement: { getMessage: jest.fn().mockReturnValue({ message: 'This is Mock' }) }
            }
        ],
        configureApp: async (app) => {
            app.connectMicroservice<MicroserviceOptions>(brokerOpts, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const rpcClient = RpcTestClient.create(brokerOpts)
    const sampleService = testContext.module.get(SampleService)

    async function teardown() {
        await rpcClient.close()
        await testContext.close()
    }

    return { teardown, rpcClient, httpClient, sampleService }
}

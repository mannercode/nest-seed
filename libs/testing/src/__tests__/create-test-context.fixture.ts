import { Controller, Get, Injectable, Param } from '@nestjs/common'
import { MicroserviceOptions, NatsOptions } from '@nestjs/microservices'
import { MessagePattern, Payload, Transport } from '@nestjs/microservices'
import { HttpTestClient } from '../http.test-client'
import { createHttpTestContext, getNatsTestConnection, RpcTestClient, withTestId } from '../index'

export type TestContextFixture = {
    httpClient: HttpTestClient
    rpcClient: RpcTestClient
    sampleService: SampleService
    teardown: () => Promise<void>
}

@Injectable()
export class SampleService {
    getMessage() {
        return 'This method should not be called'
    }
}

@Controller()
class SampleController {
    @Get('message/:arg')
    async getHttpMessage(@Param('arg') arg: string) {
        return { received: arg }
    }

    @MessagePattern(withTestId('getRpcMessage'))
    getRpcMessage(@Payload() request: { arg: string }) {
        return { id: request.arg }
    }
}

export async function createTestContextFixture(): Promise<TestContextFixture> {
    const brokerOpts = {
        options: getNatsTestConnection(),
        transport: Transport.NATS
    } as NatsOptions

    const { httpClient, ...ctx } = await createHttpTestContext({
        configureApp: async (app) => {
            app.connectMicroservice<MicroserviceOptions>(brokerOpts, { inheritAppConfig: true })
            await app.startAllMicroservices()
        },
        controllers: [SampleController],
        overrideProviders: [
            {
                original: SampleService,
                replacement: { getMessage: jest.fn().mockReturnValue({ message: 'This is Mock' }) }
            }
        ],
        providers: [SampleService]
    })

    const rpcClient = RpcTestClient.create(brokerOpts)
    const sampleService = ctx.module.get(SampleService)

    const teardown = async () => {
        await rpcClient.close()
        await ctx.close()
    }

    return { httpClient, rpcClient, sampleService, teardown }
}

import { Controller, Get, Query, ValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
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
import { PaginationDto } from '..'

export const maxTakeValue = 50

@Controller()
class SamplesController {
    @Get('pagination')
    async getPagination(@Query() query: PaginationDto) {
        return { response: query }
    }

    @MessagePattern(withTestId('getRpcPagination'))
    getRpcPagination(@Payload() query: PaginationDto) {
        return { response: query }
    }
}

export type PaginationFixture = {
    teardown: () => Promise<void>
    httpClient: HttpTestClient
    rpcClient: RpcTestClient
}

export async function createPaginationFixture() {
    const brokerOpts = {
        transport: Transport.NATS,
        options: getNatsTestConnection()
    } as NatsOptions

    const { httpClient, ...testContext } = await createHttpTestContext({
        controllers: [SamplesController],
        providers: [
            {
                provide: APP_PIPE,
                useFactory() {
                    return new ValidationPipe({
                        transform: true,
                        transformOptions: { enableImplicitConversion: true }
                    })
                }
            }
        ],
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

    return { teardown, httpClient, rpcClient }
}

import type { MicroserviceOptions, NatsOptions } from '@nestjs/microservices'
import type { HttpTestClient } from 'testlib'
import { Controller, Get, Query, ValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { MessagePattern, Payload, Transport } from '@nestjs/microservices'
import { createHttpTestContext, getNatsTestConnection, RpcTestClient, withTestId } from 'testlib'
import type { PaginationDto } from '..'

export const maxTakeValue = 50

export type PaginationFixture = {
    httpClient: HttpTestClient
    rpcClient: RpcTestClient
    teardown: () => Promise<void>
}

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

export async function createPaginationFixture() {
    const brokerOpts = {
        options: getNatsTestConnection(),
        transport: Transport.NATS
    } as NatsOptions

    const { httpClient, ...ctx } = await createHttpTestContext({
        configureApp: async (app) => {
            app.connectMicroservice<MicroserviceOptions>(brokerOpts, { inheritAppConfig: true })
            await app.startAllMicroservices()
        },
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
        ]
    })

    const rpcClient = RpcTestClient.create(brokerOpts)

    const teardown = async () => {
        await rpcClient.close()
        await ctx.close()
    }

    return { httpClient, rpcClient, teardown }
}

import { HttpTestClient } from '@mannercode/testing'
import {
    createHttpTestContext,
    getNatsTestConnection,
    RpcTestClient,
    withTestId
} from '@mannercode/testing'
import { Controller, Get, NotFoundException } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { NatsOptions } from '@nestjs/microservices'
import { MessagePattern, Transport } from '@nestjs/microservices'
import { RpcExceptionLoggerFilter } from '../rpc-exception-logger.filter'
import { RpcSuccessLoggerInterceptor } from '../rpc-success-logger.interceptor'

export type RpcExceptionLoggerFilterFixture = {
    httpClient: HttpTestClient
    rpcClient: RpcTestClient
    spyError: jest.SpyInstance
    spyWarn: jest.SpyInstance
    teardown: () => Promise<void>
}

@Controller()
class TestController {
    @Get('error')
    getHttpError() {
        throw new Error('error message')
    }

    @Get('exception')
    getHttpException() {
        throw new NotFoundException({ code: 'ERR_CODE', message: 'message' })
    }

    @MessagePattern(withTestId('error'))
    getRpcError() {
        throw new Error('error message')
    }

    @MessagePattern(withTestId('exception'))
    getRpcException() {
        throw new NotFoundException({ code: 'ERR_CODE', message: 'message' })
    }
}

export async function createRpcExceptionLoggerFilterFixture() {
    const brokerOptions = {
        options: getNatsTestConnection(),
        transport: Transport.NATS
    } as NatsOptions

    const { httpClient, ...ctx } = await createHttpTestContext({
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        },
        controllers: [TestController],
        providers: [
            { provide: APP_FILTER, useClass: RpcExceptionLoggerFilter },
            { provide: APP_INTERCEPTOR, useClass: RpcSuccessLoggerInterceptor }
        ]
    })

    const { Logger } = await import('@nestjs/common')
    const spyWarn = jest.spyOn(Logger, 'warn')
    const spyError = jest.spyOn(Logger, 'error')
    const rpcClient = RpcTestClient.create(brokerOptions)

    const teardown = async () => {
        await rpcClient.close()
        await ctx.close()
    }

    return { httpClient, rpcClient, spyError, spyWarn, teardown }
}

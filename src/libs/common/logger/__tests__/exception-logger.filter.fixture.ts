import { Controller, Get, NotFoundException } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { NatsOptions } from '@nestjs/microservices'
import { MessagePattern, Transport } from '@nestjs/microservices'
import { ExceptionLoggerFilter } from 'common'
import { HttpTestClient } from 'testlib'
import { createHttpTestContext, getNatsTestConnection, RpcTestClient, withTestId } from 'testlib'

export type ExceptionLoggerFilterFixture = {
    httpClient: HttpTestClient
    rpcClient: RpcTestClient
    spyError: jest.SpyInstance
    spyFatal: jest.SpyInstance
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

    @Get('fatal')
    getHttpFatalError() {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'fatal error message'
    }

    @MessagePattern(withTestId('error'))
    getRpcError() {
        throw new Error('error message')
    }

    @MessagePattern(withTestId('exception'))
    getRpcException() {
        throw new NotFoundException({ code: 'ERR_CODE', message: 'message' })
    }

    @MessagePattern(withTestId('fatal'))
    getRpcFatalError() {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'fatal error message'
    }
}

export async function createExceptionLoggerFilterFixture() {
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
        providers: [{ provide: APP_FILTER, useClass: ExceptionLoggerFilter }]
    })

    const { Logger } = await import('@nestjs/common')
    const spyWarn = jest.spyOn(Logger, 'warn')
    const spyError = jest.spyOn(Logger, 'error')
    const spyFatal = jest.spyOn(Logger, 'fatal')
    const rpcClient = RpcTestClient.create(brokerOptions)

    const teardown = async () => {
        await rpcClient.close()
        await ctx.close()
    }

    return { httpClient, rpcClient, spyError, spyFatal, spyWarn, teardown }
}

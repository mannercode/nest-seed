import { Controller, Get, NotFoundException } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { MessagePattern, NatsOptions, Transport } from '@nestjs/microservices'
import { ExceptionLoggerFilter } from 'common'
import {
    createHttpTestContext,
    getNatsTestConnection,
    HttpTestClient,
    RpcTestClient,
    withTestId
} from 'testlib'

@Controller()
class TestController {
    @Get('exception')
    getHttpException() {
        throw new NotFoundException({ code: 'ERR_CODE', message: 'message' })
    }

    @Get('error')
    getHttpError() {
        throw new Error('error message')
    }

    @Get('fatal')
    getHttpFatalError() {
        throw 'fatal error message'
    }

    @MessagePattern(withTestId('exception'))
    getRpcException() {
        throw new NotFoundException({ code: 'ERR_CODE', message: 'message' })
    }

    @MessagePattern(withTestId('error'))
    getRpcError() {
        throw new Error('error message')
    }

    @MessagePattern(withTestId('fatal'))
    getRpcFatalError() {
        throw 'fatal error message'
    }
}

export type ExceptionLoggerFilterFixture = {
    teardown: () => Promise<void>
    httpClient: HttpTestClient
    rpcClient: RpcTestClient
    spyWarn: jest.SpyInstance
    spyError: jest.SpyInstance
    spyFatal: jest.SpyInstance
}

export async function createExceptionLoggerFilterFixture() {
    const brokerOptions = {
        transport: Transport.NATS,
        options: getNatsTestConnection()
    } as NatsOptions

    const { httpClient, ...testContext } = await createHttpTestContext({
        controllers: [TestController],
        providers: [{ provide: APP_FILTER, useClass: ExceptionLoggerFilter }],
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const { Logger } = await import('@nestjs/common')
    const spyWarn = jest.spyOn(Logger, 'warn')
    const spyError = jest.spyOn(Logger, 'error')
    const spyFatal = jest.spyOn(Logger, 'fatal')
    const rpcClient = RpcTestClient.create(brokerOptions)

    async function teardown() {
        await rpcClient.close()
        await testContext.close()
    }

    return { teardown, httpClient, rpcClient, spyWarn, spyError, spyFatal }
}

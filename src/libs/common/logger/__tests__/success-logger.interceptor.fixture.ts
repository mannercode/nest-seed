import { Provider } from '@nestjs/common'
import { Controller, Get, Post } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { NatsOptions } from '@nestjs/microservices'
import { MessagePattern, Transport } from '@nestjs/microservices'
import { SuccessLoggerInterceptor } from 'common'
import { HttpTestClient } from 'testlib'
import { createHttpTestContext, getNatsTestConnection, RpcTestClient, withTestId } from 'testlib'

export type SuccessLoggerInterceptorFixture = {
    httpClient: HttpTestClient
    rpcClient: RpcTestClient
    spyError: jest.SpyInstance
    spyVerbose: jest.SpyInstance
    teardown: () => Promise<void>
}

@Controller()
class TestController {
    @MessagePattern(withTestId('exclude-path'))
    excludeRpc() {
        return { result: 'success' }
    }

    @Get('exclude-path')
    async getExcludePath() {
        return { result: 'success' }
    }

    @Post('success')
    async httpSuccess() {
        return { result: 'success' }
    }

    @MessagePattern(withTestId('success'))
    rpcSuccess() {
        return { result: 'success' }
    }
}

export async function createSuccessLoggerInterceptorFixture(providers: Provider[]) {
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
        providers: [{ provide: APP_INTERCEPTOR, useClass: SuccessLoggerInterceptor }, ...providers]
    })

    const { Logger } = await import('@nestjs/common')
    const spyVerbose = jest.spyOn(Logger, 'verbose')
    const spyError = jest.spyOn(Logger, 'error')

    const rpcClient = RpcTestClient.create(brokerOptions)

    const teardown = async () => {
        await rpcClient.close()
        await ctx.close()
    }

    return { httpClient, rpcClient, spyError, spyVerbose, teardown }
}

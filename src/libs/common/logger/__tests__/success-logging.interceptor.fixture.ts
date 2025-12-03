import { Controller, Get, Post, Provider } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { MessagePattern, NatsOptions, Transport } from '@nestjs/microservices'
import { SuccessLoggingInterceptor } from 'common'
import { createHttpTestContext, HttpTestClient, RpcTestClient, withTestId } from 'testlib'

@Controller()
class TestController {
    @Post('success')
    async httpSuccess() {
        return { result: 'success' }
    }

    @MessagePattern(withTestId('success'))
    rpcSuccess() {
        return { result: 'success' }
    }

    @Get('exclude-path')
    async getExcludePath() {
        return { result: 'success' }
    }

    @MessagePattern(withTestId('exclude-path'))
    excludeRpc() {
        return { result: 'success' }
    }
}

export type SuccessLoggingInterceptorFixture = {
    teardown: () => Promise<void>
    httpClient: HttpTestClient
    rpcClient: RpcTestClient
    spyVerbose: jest.SpyInstance
    spyError: jest.SpyInstance
}

export async function createSuccessLoggingInterceptorFixture(providers: Provider[]) {
    const brokerOptions = {
        transport: Transport.NATS,
        options: JSON.parse(process.env.NATS_OPTIONS!)
    } as NatsOptions

    const { httpClient, ...testContext } = await createHttpTestContext({
        metadata: {
            controllers: [TestController],
            providers: [
                { provide: APP_INTERCEPTOR, useClass: SuccessLoggingInterceptor },
                ...providers
            ]
        },
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const { Logger } = await import('@nestjs/common')
    const spyVerbose = jest.spyOn(Logger, 'verbose')
    const spyError = jest.spyOn(Logger, 'error')

    const rpcClient = RpcTestClient.create(brokerOptions)

    async function teardown() {
        await rpcClient.close()
        await testContext.close()
    }

    return { teardown, httpClient, rpcClient, spyVerbose, spyError }
}

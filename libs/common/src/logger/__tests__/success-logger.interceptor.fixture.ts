import { HttpTestClient } from '@mannercode/testing'
import { createHttpTestContext } from '@mannercode/testing'
import { Provider } from '@nestjs/common'
import { Controller, Get, Post } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { HttpSuccessLoggerInterceptor } from '../success-logger.interceptor'

export type SuccessLoggerInterceptorFixture = {
    httpClient: HttpTestClient
    spyError: jest.SpyInstance
    spyVerbose: jest.SpyInstance
    teardown: () => Promise<void>
}

@Controller()
class TestController {
    @Get('exclude-path')
    async getExcludePath() {
        return { result: 'success' }
    }

    @Post('success')
    async httpSuccess() {
        return { result: 'success' }
    }
}

export async function createSuccessLoggerInterceptorFixture(providers: Provider[]) {
    const { httpClient, ...ctx } = await createHttpTestContext({
        controllers: [TestController],
        providers: [
            { provide: APP_INTERCEPTOR, useClass: HttpSuccessLoggerInterceptor },
            ...providers
        ]
    })

    const { Logger } = await import('@nestjs/common')
    const spyVerbose = jest.spyOn(Logger, 'verbose')
    const spyError = jest.spyOn(Logger, 'error')

    const teardown = async () => {
        await ctx.close()
    }

    return { httpClient, spyError, spyVerbose, teardown }
}

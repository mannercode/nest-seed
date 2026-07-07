import { HttpTestClient, createHttpTestContext } from '@mannercode/testing'
import { Controller, Get, Post, Provider } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { HttpSuccessLoggerInterceptor } from '../success-logger.interceptor'

export type SuccessLoggerInterceptorFixture = {
    httpClient: HttpTestClient
    spyVerbose: jest.SpyInstance
    teardown: () => Promise<void>
}

@Controller()
class TestController {
    @Get('exclude-path')
    async getExcludePath() {
        return { result: 'success' }
    }

    @Get('exclude-path/sub')
    async getExcludeSubPath() {
        return { result: 'success' }
    }

    @Post('success')
    async httpSuccess() {
        return { result: 'success' }
    }

    @Get('failure')
    async httpFailure() {
        throw new Error('intentional')
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

    const teardown = async () => {
        await ctx.close()
    }

    return { httpClient, spyVerbose, teardown }
}

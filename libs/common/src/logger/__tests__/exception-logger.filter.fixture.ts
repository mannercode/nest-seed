import { HttpTestClient } from '@mannercode/testing'
import { createHttpTestContext } from '@mannercode/testing'
import { Controller, Get, NotFoundException } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { HttpExceptionLoggerFilter } from '../exception-logger.filter'
import { HttpSuccessLoggerInterceptor } from '../success-logger.interceptor'

export type ExceptionLoggerFilterFixture = {
    httpClient: HttpTestClient
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
}

export async function createExceptionLoggerFilterFixture() {
    const { httpClient, ...ctx } = await createHttpTestContext({
        controllers: [TestController],
        providers: [
            { provide: APP_FILTER, useClass: HttpExceptionLoggerFilter },
            { provide: APP_INTERCEPTOR, useClass: HttpSuccessLoggerInterceptor }
        ]
    })

    const { Logger } = await import('@nestjs/common')
    const spyWarn = jest.spyOn(Logger, 'warn')
    const spyError = jest.spyOn(Logger, 'error')

    const teardown = async () => {
        await ctx.close()
    }

    return { httpClient, spyError, spyWarn, teardown }
}

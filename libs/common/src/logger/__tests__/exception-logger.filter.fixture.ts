import { HttpTestClient, createHttpTestContext } from '@mannercode/testing'
import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    NotFoundException,
    Post,
    UnauthorizedException,
    UnprocessableEntityException
} from '@nestjs/common'
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

    @Post('exception')
    postHttpException(@Body() _body: unknown) {
        throw new NotFoundException({ code: 'ERR_CODE', message: 'message' })
    }

    @Get('unauthorized')
    getUnauthorized() {
        throw new UnauthorizedException({ code: 'ERR_AUTH', message: 'auth' })
    }

    @Get('unprocessable')
    getUnprocessable() {
        throw new UnprocessableEntityException({ code: 'ERR_UNPROCESSABLE', message: 'bad' })
    }

    @Get('string-response')
    getStringResponse() {
        // HttpException.getResponse()가 string을 반환하는 경로이다.
        throw new HttpException('plain string body', HttpStatus.BAD_REQUEST)
    }

    @Get('throw-string')
    getThrowString() {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'literal string thrown'
    }
}

export async function createExceptionLoggerFilterFixture(
    options: { withInterceptor?: boolean } = {}
) {
    const { withInterceptor = true } = options
    const providers: any[] = [{ provide: APP_FILTER, useClass: HttpExceptionLoggerFilter }]
    if (withInterceptor) {
        providers.push({ provide: APP_INTERCEPTOR, useClass: HttpSuccessLoggerInterceptor })
    }

    const { httpClient, ...ctx } = await createHttpTestContext({
        controllers: [TestController],
        providers
    })

    const { Logger } = await import('@nestjs/common')
    const spyWarn = jest.spyOn(Logger, 'warn')
    const spyError = jest.spyOn(Logger, 'error')

    const teardown = async () => {
        await ctx.close()
    }

    return { httpClient, spyError, spyWarn, teardown }
}

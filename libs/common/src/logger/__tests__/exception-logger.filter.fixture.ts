import type { MockInstance } from 'vitest'
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
import { sleep } from '../../utils/index.js'
import { HttpExceptionLoggerFilter, HttpSuccessLoggerInterceptor } from '../index.js'

export type ExceptionLoggerFilterFixture = {
    httpClient: HttpTestClient
    spyError: MockInstance
    spyWarn: MockInstance
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

    @Get('slow-exception')
    async getSlowException() {
        // 인터셉터가 마크한 진입 시각부터 duration을 재는지 확인하려고 던지기 전에 지연을 둔다.
        await sleep(50)
        throw new NotFoundException({ code: 'ERR_CODE', message: 'message' })
    }

    @Get('string-response')
    getStringResponse() {
        // HttpException.getResponse()가 string을 반환하는 경로이다.
        throw new HttpException('plain string body', HttpStatus.BAD_REQUEST)
    }

    @Get('throw-string')
    getThrowString() {
        // @Catch(Error)가 Error 이외의 thrown 값을 건너뛰는지 검증하려고 문자열을 던진다.
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
    const spyWarn = vi.spyOn(Logger, 'warn')
    const spyError = vi.spyOn(Logger, 'error')

    const teardown = async () => {
        await ctx.close()
    }

    return { httpClient, spyError, spyWarn, teardown }
}

import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { Request } from 'express'
import { defaultTo } from '../utils'
import { redactSensitive } from './redact'
import { elapsedSinceRequestStart } from './request-timing'
import { HttpErrorLog } from './types'

/**
 * HTTP 전용 예외 로거이다.
 *
 * NestJS의 예외 필터 선택은 공식 문서에 없는 내부 동작에 기댄다. 등록된
 * 필터 배열을 역순으로 훑으며 `.find`로 가장 먼저 일치하는 필터 하나만
 * 실행한다. `@Catch()` (타입 없음)는 무조건 일치하고, `@Catch(Type)`은
 * `exception instanceof Type` 일 때 일치한다. 이 알고리즘은 NestJS 버전에
 * 따라 바뀔 수 있다. 그래서 등록 순서에 의존하지 않도록 이 필터를 상속
 * 하는 방식으로 확장한다.
 *
 * 전역 필터에 동작을 더 얹어야 하면 이 클래스를 상속하고 `super.catch()`를
 * 호출한다.
 *
 * class CustomFilter extends HttpExceptionLoggerFilter {
 *     catch(exception: Error, host: ArgumentsHost) {
 *         ...
 *         super.catch(exception, host)
 *     }
 * }
 */
@Catch(Error)
export class HttpExceptionLoggerFilter extends BaseExceptionFilter {
    catch(exception: Error, host: ArgumentsHost) {
        const contextType = host.getType()

        /* istanbul ignore else */
        if (contextType === 'http') {
            this.logHttp(exception, host)
        } else {
            Logger.error('HttpExceptionLoggerFilter: unknown context type', {
                contextType,
                message: exception.message
            })
        }

        super.catch(exception, host)
    }

    protected logHttp(exception: Error, host: ArgumentsHost) {
        const httpContext = host.switchToHttp()
        const request = httpContext.getRequest<Request>()
        const { body, method, url } = request
        const httpLogBase = {
            contextType: 'http' as const,
            duration: `${elapsedSinceRequestStart(request)}ms`,
            request: { body: redactSensitive(body), method, url }
        }

        if (exception instanceof HttpException) {
            const errorLog = {
                ...httpLogBase,
                response: redactSensitive(exception.getResponse()),
                stack: defaultTo(exception.stack, '').split('\n'),
                statusCode: exception.getStatus()
            } as HttpErrorLog

            Logger.warn('fail', errorLog)
        } else {
            const errorLog = {
                ...httpLogBase,
                response: { message: exception.message },
                stack: defaultTo(exception.stack, '').split('\n'),
                statusCode: 500
            } as HttpErrorLog

            Logger.error('error', errorLog)
        }
    }
}

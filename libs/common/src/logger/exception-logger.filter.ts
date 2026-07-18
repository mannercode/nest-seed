import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { Request } from 'express'
import { defaultTo } from '../utils'
import { redactSensitive } from './redact'
import { elapsedSinceRequestStart } from './request-timing'
import { HttpErrorLog } from './types'

// Nest는 일치하는 예외 필터 하나만 실행하므로 동작을 확장할 때는 상속 후 super.catch()를 호출한다.
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

import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { Request } from 'express'
import { defaultTo } from '../utils/index.js'
import { elapsedSinceRequestStart } from './request-timing.js'
import { HttpErrorLog } from './types.js'

// Nest는 일치하는 예외 필터 하나만 실행하므로 동작을 확장할 때는 상속 후 super.catch()를 호출한다.
@Catch(Error)
export class HttpExceptionLoggerFilter extends BaseExceptionFilter {
    catch(exception: Error, host: ArgumentsHost) {
        const contextType = host.getType()

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
        const { method } = request
        const routePath =
            typeof request.route?.path === 'string' ? request.route.path : request.path
        const httpLogBase = {
            contextType: 'http' as const,
            duration: `${elapsedSinceRequestStart(request)}ms`,
            request: { method, route: request.baseUrl + routePath }
        }

        if (exception instanceof HttpException) {
            const response = exception.getResponse()
            const code =
                typeof response === 'object' &&
                typeof (response as Record<string, unknown>).code === 'string'
                    ? (response as Record<string, string>).code
                    : undefined
            const errorLog = {
                ...httpLogBase,
                error: { ...(code === undefined ? {} : { code }), name: exception.name },
                stack: defaultTo(exception.stack, '').split('\n'),
                statusCode: exception.getStatus()
            } as HttpErrorLog

            Logger.warn('fail', errorLog)
        } else {
            const errorLog = {
                ...httpLogBase,
                error: { name: exception.name },
                stack: defaultTo(exception.stack, '').split('\n'),
                statusCode: 500
            } as HttpErrorLog

            Logger.error('error', errorLog)
        }
    }
}

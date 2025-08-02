import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { RpcException } from '@nestjs/microservices'
import { Request } from 'express'
import { throwError } from 'rxjs'
import { HttpErrorLog, RpcErrorLog } from './types'

/**
 * Only one global filter can be registered at a time.
 * If you need to add another global filter, inherit from ExceptionLoggerFilter and call super.catch().
 * This approach also clarifies the order in which filters are called.
 *
 * 전역 필터는 1개만 등록 가능하다.
 * 전역 필터를 추가해야 한다면 ExceptionLoggerFilter를 상속 후 super.catch()를 호출한다.
 * 이렇게 상속을 하면 필터의 호출 순서도 명확해진다.
 *
 * class LogTransformerFilter extends ExceptionLoggerFilter {
 *     catch(exception: any, host: ArgumentsHost) {
 *         ...
 *         super.catch(exception, host)
 *     }
 * }
 */
@Catch()
export class ExceptionLoggerFilter extends BaseExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const contextType = host.getType()

        if (contextType === 'http') {
            const http = host.switchToHttp()
            const { method, url, body } = http.getRequest<Request>()

            const common = { contextType, request: { method, url, body } }

            if (exception instanceof HttpException) {
                const log = {
                    ...common,
                    statusCode: exception.getStatus(),
                    response: exception.getResponse(),
                    stack: exception.stack
                } as HttpErrorLog

                Logger.warn('fail', log)
            } else if (exception instanceof Error) {
                const log = {
                    ...common,
                    statusCode: 500,
                    response: { message: exception.message },
                    stack: exception.stack
                } as HttpErrorLog

                Logger.error('error', log)
            } else {
                const log = {
                    ...common,
                    statusCode: 500,
                    response: { message: exception },
                    stack: 'undefined'
                } as HttpErrorLog

                Logger.fatal('fatal', log)
            }

            super.catch(exception, host)
        } else if (contextType === 'rpc') {
            const ctx = host.switchToRpc()

            const common = { contextType, context: ctx.getContext(), data: ctx.getData() }

            if (exception instanceof HttpException) {
                const log = {
                    ...common,
                    response: exception.getResponse(),
                    stack: exception.stack
                } as RpcErrorLog

                Logger.warn('fail', log)

                return throwError(() => exception)
            } else if (exception instanceof Error) {
                const log = {
                    ...common,
                    response: { message: exception.message },
                    stack: exception.stack
                } as RpcErrorLog

                Logger.error('error', log)

                return throwError(() => new RpcException(exception))
            } else {
                const log = {
                    ...common,
                    response: { message: exception },
                    stack: 'undefined'
                } as RpcErrorLog

                Logger.fatal('fatal', log)

                return throwError(() => new RpcException(exception))
            }
        } else {
            Logger.error('unknown context type', { contextType, ...exception })

            super.catch(exception, host)
        }
    }
}

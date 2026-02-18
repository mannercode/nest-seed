import { ArgumentsHost } from '@nestjs/common'
import { Catch, HttpException, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { RpcException } from '@nestjs/microservices'
import { Request } from 'express'
import { defaultTo } from 'lodash'
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
            const httpContext = host.switchToHttp()
            const { body, method, url } = httpContext.getRequest<Request>()

            const httpLogBase = { contextType, request: { body, method, url } }

            if (exception instanceof HttpException) {
                const errorLog = {
                    ...httpLogBase,
                    response: exception.getResponse(),
                    stack: defaultTo(exception.stack, '').split('\n'),
                    statusCode: exception.getStatus()
                } as HttpErrorLog

                Logger.warn('fail', errorLog)
            } else if (exception instanceof Error) {
                const errorLog = {
                    ...httpLogBase,
                    response: { message: exception.message },
                    stack: defaultTo(exception.stack, '').split('\n'),
                    statusCode: 500
                } as HttpErrorLog

                Logger.error('error', errorLog)
            } else {
                const errorLog = {
                    ...httpLogBase,
                    response: { message: exception },
                    stack: [],
                    statusCode: 500
                } as HttpErrorLog

                Logger.fatal('fatal', errorLog)
            }

            super.catch(exception, host)
            return undefined
        } else if (contextType === 'rpc') {
            const rpcContext = host.switchToRpc()

            const rpcLogBase = {
                context: rpcContext.getContext(),
                contextType,
                data: rpcContext.getData()
            }

            if (exception instanceof HttpException) {
                const errorLog = {
                    ...rpcLogBase,
                    response: exception.getResponse(),
                    stack: defaultTo(exception.stack, '').split('\n')
                } as RpcErrorLog

                Logger.warn('fail', errorLog)

                return throwError(() => exception)
            } else if (exception instanceof Error) {
                const errorLog = {
                    ...rpcLogBase,
                    response: { message: exception.message },
                    stack: defaultTo(exception.stack, '').split('\n')
                } as RpcErrorLog

                Logger.error('error', errorLog)

                return throwError(() => new RpcException(exception))
            } else {
                const errorLog = {
                    ...rpcLogBase,
                    response: { message: exception },
                    stack: []
                } as RpcErrorLog

                Logger.fatal('fatal', errorLog)

                return throwError(() => new RpcException(exception))
            }
        } else {
            Logger.error('unknown context type', { contextType, ...exception })

            super.catch(exception, host)
            return undefined
        }
    }
}

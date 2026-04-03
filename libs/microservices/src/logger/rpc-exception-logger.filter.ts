import { defaultTo, HttpExceptionLoggerFilter } from '@mannercode/common'
import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common'
import { RpcException } from '@nestjs/microservices'
import { throwError } from 'rxjs'
import { RpcErrorLog } from './types'

/**
 * RPC 예외 로거. HttpExceptionLoggerFilter를 상속하여 HTTP + RPC를 모두 처리한다.
 * MSA 프로젝트에서는 이 필터를 전역 필터로 등록한다.
 */
@Catch(Error)
export class RpcExceptionLoggerFilter extends HttpExceptionLoggerFilter {
    catch(exception: Error, host: ArgumentsHost) {
        const contextType = host.getType()

        if (contextType === 'rpc') {
            return this.logRpc(exception, host)
        }

        super.catch(exception, host)
        return undefined
    }

    private logRpc(exception: Error, host: ArgumentsHost) {
        const rpcContext = host.switchToRpc()
        const rpcCallContext = rpcContext.getContext()

        const rpcLogBase = {
            contextType: 'rpc' as const,
            duration: `${Date.now() - rpcCallContext._startTimestamp}ms`,
            request: { subject: rpcCallContext.args?.[0], data: rpcContext.getData() }
        }

        if (exception instanceof HttpException) {
            const errorLog = {
                ...rpcLogBase,
                response: exception.getResponse(),
                stack: defaultTo(exception.stack, '').split('\n')
            } as RpcErrorLog

            Logger.warn('fail', errorLog)

            return throwError(() => exception)
        } else {
            const errorLog = {
                ...rpcLogBase,
                response: { message: exception.message },
                stack: defaultTo(exception.stack, '').split('\n')
            } as RpcErrorLog

            Logger.error('error', errorLog)

            return throwError(() => new RpcException(exception))
        }
    }
}

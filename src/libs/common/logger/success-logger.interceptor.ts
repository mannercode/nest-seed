import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { Request, Response } from 'express'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { HttpSuccessLog, RpcSuccessLog } from './types'

@Injectable()
export class SuccessLoggerInterceptor implements NestInterceptor {
    constructor(
        @Optional()
        @Inject('LOGGING_EXCLUDE_HTTP_PATHS')
        private readonly excludeHttpPaths: string[] | undefined,
        @Optional()
        @Inject('LOGGING_EXCLUDE_RPC_PATHS')
        private readonly excludeRpcPaths: string[] | undefined
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const startTimestamp = Date.now()

        const contextType = context.getType()

        return next.handle().pipe(
            tap({
                complete: () => {
                    const elapsedMs = Date.now() - startTimestamp

                    if (contextType === 'http') {
                        const httpContext = context.switchToHttp()
                        const response = httpContext.getResponse<Response>()
                        const { body, method, url } = httpContext.getRequest<Request>()

                        if (this.shouldLogHttp(url)) {
                            const successLog = {
                                contextType,
                                duration: `${elapsedMs}ms`,
                                request: { body, method, url },
                                statusCode: response.statusCode
                            } as HttpSuccessLog

                            Logger.verbose('success', successLog)
                        }
                    } else if (contextType === 'rpc') {
                        const rpcContext = context.switchToRpc()
                        const rpcCallContext = rpcContext.getContext()

                        if (this.shouldLogRpc(rpcCallContext.args)) {
                            const successLog = {
                                context: rpcCallContext,
                                contextType,
                                data: rpcContext.getData(),
                                duration: `${elapsedMs}ms`
                            } as RpcSuccessLog

                            Logger.verbose('success', successLog)
                        }
                    } else {
                        Logger.error('unknown context type', {
                            contextType,
                            duration: `${elapsedMs}ms`
                        })
                    }
                }
            })
        )
    }

    private shouldLogHttp(url: string): boolean {
        if (this.excludeHttpPaths === undefined) return true

        return !this.excludeHttpPaths.some((exclude) => url === exclude)
    }

    private shouldLogRpc(args: unknown): boolean {
        if (this.excludeRpcPaths === undefined) return true
        if (!Array.isArray(args)) return true

        const stringArgs = args.filter((arg): arg is string => typeof arg === 'string')
        return !this.excludeRpcPaths.some((exclude) => stringArgs.includes(exclude))
    }
}

import {
    CallHandler,
    ExecutionContext,
    Inject,
    Injectable,
    Logger,
    NestInterceptor,
    Optional
} from '@nestjs/common'
import { Request, Response } from 'express'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { HttpSuccessLog, RpcSuccessLog } from './types'

@Injectable()
export class SuccessLoggingInterceptor implements NestInterceptor {
    constructor(
        @Optional()
        @Inject('LOGGING_EXCLUDE_HTTP_PATHS')
        private readonly excludeHttpPaths: string[] | undefined,
        @Optional()
        @Inject('LOGGING_EXCLUDE_RPC_PATHS')
        private readonly excludeRpcPaths: string[] | undefined
    ) {}

    private shouldHttpLog(url: string): boolean {
        if (this.excludeHttpPaths === undefined) return true

        return !this.excludeHttpPaths.some((exclude) => url === exclude)
    }

    private shouldRpcLog(args: unknown): boolean {
        if (this.excludeRpcPaths === undefined) return true
        if (!Array.isArray(args)) return true

        const stringArgs = args.filter((arg): arg is string => typeof arg === 'string')
        return !this.excludeRpcPaths.some((exclude) => stringArgs.includes(exclude))
    }

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
                        const { method, url, body } = httpContext.getRequest<Request>()

                        if (this.shouldHttpLog(url)) {
                            const successLog = {
                                contextType,
                                statusCode: response.statusCode,
                                request: { method, url, body },
                                duration: `${elapsedMs}ms`
                            } as HttpSuccessLog

                            Logger.verbose('success', successLog)
                        }
                    } else if (contextType === 'rpc') {
                        const rpcContext = context.switchToRpc()
                        const rpcCallContext = rpcContext.getContext()

                        if (this.shouldRpcLog(rpcCallContext.args)) {
                            const successLog = {
                                contextType,
                                context: rpcCallContext,
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
}

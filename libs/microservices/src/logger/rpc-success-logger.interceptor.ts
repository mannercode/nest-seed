import { HttpSuccessLoggerInterceptor } from '@mannercode/common'
import { CallHandler, ExecutionContext, Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { RpcSuccessLog } from './types'

@Injectable()
export class RpcSuccessLoggerInterceptor extends HttpSuccessLoggerInterceptor {
    constructor(
        @Optional()
        @Inject('LOGGING_EXCLUDE_HTTP_PATHS')
        excludeHttpPaths: string[] | undefined,
        @Optional()
        @Inject('LOGGING_EXCLUDE_RPC_PATHS')
        private readonly excludeRpcPaths: string[] | undefined
    ) {
        super(excludeHttpPaths)
    }

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const contextType = context.getType()

        if (contextType === 'rpc') {
            return this.interceptRpc(context, next)
        }

        return super.intercept(context, next)
    }

    private interceptRpc(context: ExecutionContext, next: CallHandler): Observable<any> {
        const startTimestamp = Date.now()
        const rpcContext = context.switchToRpc().getContext()
        rpcContext._startTimestamp = startTimestamp

        let responseData: any

        return next.handle().pipe(
            tap({
                next: (data) => {
                    responseData = data
                },
                complete: () => {
                    const elapsedMs = Date.now() - startTimestamp

                    if (this.shouldLogRpc(rpcContext.args)) {
                        const successLog = {
                            contextType: 'rpc' as const,
                            duration: `${elapsedMs}ms`,
                            request: {
                                subject: rpcContext.args?.[0],
                                data: context.switchToRpc().getData()
                            },
                            response: responseData
                        } as RpcSuccessLog

                        Logger.verbose('success', successLog)
                    }
                }
            })
        )
    }

    private shouldLogRpc(args: unknown): boolean {
        if (this.excludeRpcPaths === undefined) return true
        /* istanbul ignore next */
        if (!Array.isArray(args)) return true

        const stringArgs = args.filter((arg): arg is string => typeof arg === 'string')
        return !this.excludeRpcPaths.some((exclude) => stringArgs.includes(exclude))
    }
}

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
import { redactSensitive } from './redact'
import { markRequestStart } from './request-timing'
import { HttpSuccessLog } from './types'

@Injectable()
export class HttpSuccessLoggerInterceptor implements NestInterceptor {
    constructor(
        @Optional()
        @Inject('LOGGING_EXCLUDE_HTTP_PATHS')
        private readonly excludeHttpPaths: string[] | undefined
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const startTimestamp = Date.now()

        const contextType = context.getType()

        /* istanbul ignore else */
        if (contextType === 'http') {
            markRequestStart(context.switchToHttp().getRequest<Request>())
        }

        let responseData: any

        return next.handle().pipe(
            tap({
                next: (data) => {
                    responseData = data
                },
                complete: () => {
                    const elapsedMs = Date.now() - startTimestamp

                    /* istanbul ignore else */
                    if (contextType === 'http') {
                        this.logHttp(context, elapsedMs, responseData)
                    } else {
                        Logger.error('HttpSuccessLoggerInterceptor: unknown context type', {
                            contextType,
                            duration: `${elapsedMs}ms`
                        })
                    }
                }
            })
        )
    }

    protected logHttp(context: ExecutionContext, elapsedMs: number, responseData: any) {
        const httpContext = context.switchToHttp()
        const httpResponse = httpContext.getResponse<Response>()
        const { body, method, url } = httpContext.getRequest<Request>()

        if (this.shouldLogHttp(url)) {
            const successLog = {
                contextType: 'http' as const,
                duration: `${elapsedMs}ms`,
                request: { body: redactSensitive(body), method, url },
                response: redactSensitive(responseData),
                statusCode: httpResponse.statusCode
            } as HttpSuccessLog

            Logger.verbose('success', successLog)
        }
    }

    private shouldLogHttp(url: string): boolean {
        if (this.excludeHttpPaths === undefined) return true

        return !this.excludeHttpPaths.some((exclude) => url === exclude)
    }
}

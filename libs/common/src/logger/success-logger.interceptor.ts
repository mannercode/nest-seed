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
import { redactSensitive } from './redact.js'
import { elapsedSinceRequestStart, markRequestStart } from './request-timing.js'
import { HttpSuccessLog } from './types.js'

@Injectable()
export class HttpSuccessLoggerInterceptor implements NestInterceptor {
    constructor(
        @Optional()
        @Inject('LOGGING_EXCLUDE_HTTP_PATHS')
        private readonly excludeHttpPaths: string[] | undefined
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const contextType = context.getType()

        // 이 전역 인터셉터는 HTTP 앱에만 등록된다. 비HTTP 분기는 오등록 진단용이라 coverage에서 제외한다.
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
                    // 비HTTP 완료 경로도 위와 같은 오등록 진단 분기다.
                    /* istanbul ignore else */
                    if (contextType === 'http') {
                        this.logHttp(context, responseData)
                    } else {
                        Logger.error('HttpSuccessLoggerInterceptor: unknown context type', {
                            contextType
                        })
                    }
                }
            })
        )
    }

    protected logHttp(context: ExecutionContext, responseData: any) {
        const httpContext = context.switchToHttp()
        const httpResponse = httpContext.getResponse<Response>()
        const request = httpContext.getRequest<Request>()
        const { body, method, url } = request

        if (this.shouldLogHttp(url)) {
            const elapsedMs = elapsedSinceRequestStart(request)
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

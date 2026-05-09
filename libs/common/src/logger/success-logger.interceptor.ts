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
import { elapsedSinceRequestStart, markRequestStart } from './request-timing'
import { HttpSuccessLog } from './types'

@Injectable()
export class HttpSuccessLoggerInterceptor implements NestInterceptor {
    constructor(
        @Optional()
        @Inject('LOGGING_EXCLUDE_HTTP_PATHS')
        private readonly excludeHttpPaths: string[] | undefined
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
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
            // 시작 시각은 markRequestStart 가 WeakMap 에 박아둔 값을 그대로 쓴다 —
            // 이 인터셉터가 실패하고 ExceptionLoggerFilter 가 받았을 때와 동일한
            // 기준점이라 success/fail 로그 사이에 미세한 시각 차가 생기지 않는다.
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

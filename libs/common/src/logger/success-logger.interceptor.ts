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

        return next.handle().pipe(
            tap({
                complete: () => {
                    // 비HTTP 완료 경로도 위와 같은 오등록 진단 분기다.
                    /* istanbul ignore else */
                    if (contextType === 'http') {
                        this.logHttp(context)
                    } else {
                        Logger.error('HttpSuccessLoggerInterceptor: unknown context type', {
                            contextType
                        })
                    }
                }
            })
        )
    }

    protected logHttp(context: ExecutionContext) {
        const httpContext = context.switchToHttp()
        const httpResponse = httpContext.getResponse<Response>()
        const request = httpContext.getRequest<Request>()
        const { method } = request
        const routePath =
            typeof request.route?.path === 'string' ? request.route.path : request.path
        const route = request.baseUrl + routePath

        if (this.shouldLogHttp(route)) {
            const elapsedMs = elapsedSinceRequestStart(request)
            const successLog = {
                contextType: 'http' as const,
                duration: `${elapsedMs}ms`,
                request: { method, route },
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

import { Request, Response } from 'express'
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

@Injectable()
export class HttpSuccessInterceptor implements NestInterceptor {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const now = Date.now()

        const http = context.switchToHttp()
        const response = http.getResponse<Response>()
        const request = http.getRequest<Request>()

        return next.handle().pipe(
            tap({
                complete: () => {
                    const logDetails = {
                        statusCode: response.statusCode,
                        request: { method: request.method, url: request.url },
                        duration: `${Date.now() - now}ms`
                    }

                    Logger.verbose('Success', 'HTTP', logDetails)
                }
            })
        )
    }
}

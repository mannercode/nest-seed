import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import { Response } from 'express'
import { catchError, lastValueFrom, Observable, throwError } from 'rxjs'
import { jsonToObject } from '../utils'

@Catch()
export class HttpToRpcExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const contextType = host.getType()

        if (contextType === 'rpc') {
            let error = {}

            if (exception instanceof HttpException) {
                error = { status: exception.getStatus(), response: exception.getResponse() }
            } else if (exception instanceof Error) {
                error = {
                    status: 500,
                    response: {
                        message: exception.message,
                        error: 'Internal server error',
                        statusCode: 500
                    }
                }
            }

            return throwError(() => error)
        } else if (contextType === 'http') {
            const ctx = host.switchToHttp()
            const response = ctx.getResponse<Response>()
            const statusCode = exception.getStatus()
            const responseBody = exception.getResponse()

            response.status(statusCode).json(responseBody)
        }
    }
}

// TODO 이거 적절한 위치?
export async function waitProxyValue<T>(observer: Observable<T>): Promise<T> {
    return lastValueFrom(
        observer.pipe(
            catchError((error) => {
                throw new HttpException(error.response, error.status)
            })
        )
    )
}

export async function getProxyValue<T>(observer: Observable<T>): Promise<T> {
    return jsonToObject(await waitProxyValue(observer))
}

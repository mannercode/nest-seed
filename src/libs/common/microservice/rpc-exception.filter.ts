import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import { Response } from 'express'
import { throwError } from 'rxjs'

@Catch()
export class RpcExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const contextType = host.getType()

        if (contextType === 'rpc') {
            let error = { statusCode: -1, message: 'undefined', error: 'undefined' }

            if (exception instanceof HttpException) {
                const response = exception.getResponse() as { message: string; error: string }

                error = { ...response, statusCode: exception.getStatus() }
            } else if (exception instanceof Error) {
                error = {
                    message: exception.message,
                    error: 'Internal server error',
                    statusCode: 500
                }
            }

            return throwError(() => error)
        } else if (contextType === 'http') {
            const ctx = host.switchToHttp()
            const response = ctx.getResponse<Response>()
            const statusCode = exception.getStatus()
            const { statusCode: _, ...responseBody } = exception.getResponse()

            response.status(statusCode).json(responseBody)
        }
    }
}

import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import { Response } from 'express'
import { throwError } from 'rxjs'

@Catch()
export class RpcExceptionFilter implements ExceptionFilter {
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

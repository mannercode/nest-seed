import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import { Request, Response } from 'express'
import { CommonErrors } from '../common-errors'
import { throwError } from 'rxjs'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const contextType = host.getType()

        if (contextType === 'http') {
            const http = host.switchToHttp()
            const response = http.getResponse<Response>()
            const request = http.getRequest<Request>()

            let statusCode = 0
            let responseBody = {}

            if (exception instanceof HttpException) {
                statusCode = exception.getStatus()
                const { statusCode: _, ...rest } = exception.getResponse() as any
                responseBody = rest

                if (typeof responseBody === 'object' && 'message' in responseBody) {
                    // Multer Exception
                    if (statusCode === 400 && responseBody.message === 'Too many files') {
                        responseBody = CommonErrors.FileUpload.MaxCountExceeded
                    }
                    // Multer Exception
                    else if (statusCode === 413 && responseBody.message === 'File too large') {
                        responseBody = CommonErrors.FileUpload.MaxSizeExceeded
                    }
                    // Passport Exception
                    else if (statusCode === 401 && responseBody.message === 'Unauthorized') {
                        responseBody = CommonErrors.Auth.Unauthorized
                    }
                }
            } else if (exception instanceof Error) {
                statusCode = 500
                responseBody = {
                    message: exception.message,
                    error: 'Internal server error'
                }
            }

            response.status(statusCode).json(responseBody)

            const message = exception.message

            const logDetails = {
                statusCode,
                request: { method: request.method, url: request.url, body: request.body },
                response: responseBody
            }

            Logger.warn(message, 'HTTP', { ...logDetails, stack: exception.stack })
        } else if (contextType === 'rpc') {
            return throwError(() => exception)
        }
    }
}

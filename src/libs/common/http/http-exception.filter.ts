import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import { Request, Response } from 'express'
import { CommonErrors } from '../common-errors'

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const http = host.switchToHttp()
        const response = http.getResponse<Response>()
        const request = http.getRequest<Request>()

        const statusCode = exception.getStatus()
        let responseBody = exception.getResponse()

        if (
            typeof responseBody === 'object' &&
            !('code' in responseBody) &&
            'message' in responseBody
        ) {
            if (statusCode === 400 && responseBody.message === 'Too many files') {
                responseBody = CommonErrors.FileUpload.MaxCountExceeded
            } else if (statusCode === 413 && responseBody.message === 'File too large') {
                responseBody = CommonErrors.FileUpload.MaxSizeExceeded
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
    }
}

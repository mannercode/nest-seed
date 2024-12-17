import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import { Request, Response } from 'express'

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<Request>()

        const statusCode = exception.getStatus()
        let responseBody = exception.getResponse()

        if (
            typeof responseBody === 'object' &&
            !('code' in responseBody) &&
            'message' in responseBody
        ) {
            if (statusCode === 400 && responseBody.message === 'Too many files') {
                responseBody = { code: 'ERR_MAX_COUNT_EXCEED', message: responseBody.message }
            } else if (statusCode === 413 && responseBody.message === 'File too large') {
                responseBody = { code: 'ERR_MAX_SIZE_EXCEED', message: responseBody.message }
            }
        }

        response.status(statusCode).json(responseBody)

        const message = exception.message

        const additionalInfo = {
            statusCode,
            request: {
                method: request.method,
                url: request.url,
                body: request.body
            },
            response: responseBody
        }

        // 2xx and 5xx errors are not allowed here.
        // 2xx is not an exception and 5xx is handled by HttpErrorFilter
        Logger.warn(message, 'HTTP', { ...additionalInfo, stack: exception.stack })
    }
}

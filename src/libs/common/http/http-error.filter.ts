import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common'
import { Request, Response } from 'express'

@Catch(Error)
export class HttpErrorFilter implements ExceptionFilter {
    async catch(error: Error, host: ArgumentsHost) {
        const http = host.switchToHttp()
        const response = http.getResponse<Response>()
        const request = http.getRequest<Request>()

        const message = error.message
        const statusCode = HttpStatus.INTERNAL_SERVER_ERROR

        const logDetails = {
            statusCode,
            request: { method: request.method, url: request.url, body: request.body }
        }

        response.status(statusCode).json({ ...logDetails, message: 'Internal server error' })

        Logger.error(message, 'HTTP', { ...logDetails, stack: error.stack })
    }
}

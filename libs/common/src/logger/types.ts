// HttpSuccessLoggerInterceptor stashes the request start time on the Express
// request so HttpExceptionLoggerFilter (running outside the interceptor's
// closure on the error path) can compute elapsed duration.
declare module 'express' {
    interface Request {
        _startTimestamp?: number
    }
}

export type HttpErrorLog = {
    contextType: 'http'
    duration: string
    request: { body: any; method: string; url: string }
    response: object | string
    stack: string[]
    statusCode: number
}

export type HttpSuccessLog = {
    contextType: 'http'
    duration: string
    request: { body: any; method: string; url: string }
    response: any
    statusCode: number
}

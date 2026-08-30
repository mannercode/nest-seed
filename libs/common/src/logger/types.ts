export type HttpErrorLog = {
    contextType: 'http'
    duration: string
    error: { code?: string; name: string }
    request: { method: string; route: string }
    stack: string[]
    statusCode: number
}

export type HttpSuccessLog = {
    contextType: 'http'
    duration: string
    request: { method: string; route: string }
    statusCode: number
}

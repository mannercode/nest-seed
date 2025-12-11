export type HttpErrorLog = {
    contextType: 'http'
    statusCode: number
    request: { method: string; url: string; body: any }
    response: object | string
    stack?: string
}

export type HttpSuccessLog = {
    contextType: 'http'
    statusCode: number
    request: { method: string; url: string; body: any }
    duration: string
}

export type RpcErrorLog = {
    contextType: 'rpc'
    context: any
    data: any
    response: object | string
    stack?: string
}

export type RpcSuccessLog = { contextType: 'rpc'; context: any; data: any; duration: string }

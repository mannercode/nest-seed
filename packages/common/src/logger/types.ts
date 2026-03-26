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

export type RpcErrorLog = {
    contextType: 'rpc'
    duration: string
    request: { subject: string; data: any }
    response: object | string
    stack: string[]
}

export type RpcSuccessLog = {
    contextType: 'rpc'
    duration: string
    request: { subject: string; data: any }
    response: any
}

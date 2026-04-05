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

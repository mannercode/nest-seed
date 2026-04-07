export interface RpcProxy {
    emit(event: string, payload: any): Promise<void>
    onModuleDestroy(): Promise<void>
    request<T>(cmd: string, payload?: any): Promise<T>
}

export class RpcTestClient {
    constructor(private readonly proxy: RpcProxy) {}

    emit(event: string, payload: any): Promise<void> {
        return this.proxy.emit(event, payload)
    }

    request<T>(cmd: string, payload?: any): Promise<T> {
        return this.proxy.request(cmd, payload)
    }

    async close() {
        await this.proxy.onModuleDestroy()
    }

    async expectError(cmd: string, payload: any, expected: any) {
        const error = await this.proxy.request(cmd, payload).catch((e) => e)

        expect(error).toEqual(expected)
    }

    async expectRequest<T>(cmd: string, payload: any, expected: any): Promise<T> {
        const value = await this.proxy.request<T>(cmd, payload)

        if (expected !== undefined) {
            expect(value).toEqual(expected)
        }

        return value
    }
}

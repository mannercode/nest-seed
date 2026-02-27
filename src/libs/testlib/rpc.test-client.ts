import type { NatsOptions } from '@nestjs/microservices'
import { ClientProxyFactory } from '@nestjs/microservices'
import { ClientProxyService } from 'common'

export class RpcTestClient extends ClientProxyService {
    static create(options: NatsOptions) {
        const proxy = ClientProxyFactory.create(options)

        return new RpcTestClient(proxy)
    }

    async close() {
        await this.onModuleDestroy()
    }

    async expectError(cmd: string, payload: any, expected: any) {
        const promise = super.request(cmd, payload)
        const error = await promise.catch((e) => e)

        expect(error).toEqual(expected)
    }

    async expectRequest<T>(cmd: string, payload: any, expected: any): Promise<T> {
        const value = await super.request<T>(cmd, payload)

        if (expected !== undefined) {
            expect(value).toEqual(expected)
        }

        return value
    }
}

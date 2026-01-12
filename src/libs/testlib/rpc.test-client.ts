import { ClientProxyFactory } from '@nestjs/microservices'
import { ClientProxyService } from 'common'
import type { NatsOptions } from '@nestjs/microservices'

export class RpcTestClient extends ClientProxyService {
    static create(options: NatsOptions) {
        const proxy = ClientProxyFactory.create(options)

        return new RpcTestClient(proxy)
    }

    async close() {
        await this.onModuleDestroy()
    }

    async expectRequest<T>(cmd: string, payload: any, expected: any): Promise<T> {
        const value = await super.request<T>(cmd, payload)

        if (expected) {
            expect(value).toEqual(expected)
        }

        return value
    }

    async expectError(cmd: string, payload: any, expected: any) {
        const promise = super.request(cmd, payload)
        const error = await promise.catch((e) => e)

        expect(error).toEqual(expected)
    }
}

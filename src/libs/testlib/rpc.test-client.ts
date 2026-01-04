import { ClientProxyFactory } from '@nestjs/microservices'
import { ClientProxyService } from 'common'
import type { NatsOptions } from '@nestjs/microservices'

export class RpcTestClient extends ClientProxyService {
    static create(option: NatsOptions) {
        const proxy = ClientProxyFactory.create(option)

        return new RpcTestClient(proxy)
    }

    async close() {
        await this.onModuleDestroy()
    }

    async expect<T>(cmd: string, payload: any, expected: any): Promise<T> {
        const value = await super.request<T>(cmd, payload)

        if (expected) {
            expect(value).toEqual(expected)
        }

        return value
    }

    async error(cmd: string, payload: any, expected: any) {
        const promise = super.request(cmd, payload)
        const error = await promise.catch((e) => e)

        expect(error).toEqual(expected)
    }
}

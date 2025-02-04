import { ClientProxy, ClientProxyFactory, NatsOptions } from '@nestjs/microservices'
import { generateShortId, jsonToObject } from 'common'
import { lastValueFrom } from 'rxjs'

export class MicroserviceTestClient {
    static async create(option: NatsOptions) {
        const proxy = ClientProxyFactory.create(option)

        return new MicroserviceTestClient(proxy)
    }

    constructor(public proxy: ClientProxy) {}

    async close() {
        await this.proxy.close()
    }

    async send(cmd: string, payload: any) {
        const taggedCmd = `${cmd}.${generateShortId()}`

        return jsonToObject(await lastValueFrom(this.proxy.send(taggedCmd, payload)))
    }

    async error(cmd: string, payload: any, expected: any) {
        const taggedCmd = `${cmd}.${generateShortId()}`

        const promise = lastValueFrom(this.proxy.send(taggedCmd, payload))
        await expect(promise).rejects.toMatchObject(expected)
    }
}

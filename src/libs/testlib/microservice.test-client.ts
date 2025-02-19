import { ClientProxy, ClientProxyFactory, NatsOptions } from '@nestjs/microservices'
import { jsonToObject } from 'common'
import { lastValueFrom } from 'rxjs'

export class MicroserviceTestClient {
    static create(option: NatsOptions) {
        const proxy = ClientProxyFactory.create(option)

        return new MicroserviceTestClient(proxy)
    }

    constructor(public proxy: ClientProxy) {}

    async close() {
        await this.proxy.close()
    }

    async send(cmd: string, payload: any) {
        return jsonToObject(await lastValueFrom(this.proxy.send(cmd, payload)))
    }

    async error(cmd: string, payload: any, expected: any) {
        const promise = lastValueFrom(this.proxy.send(cmd, payload))
        await expect(promise).rejects.toMatchObject(expected)
    }
}

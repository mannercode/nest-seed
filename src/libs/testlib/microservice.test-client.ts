import { HttpStatus } from '@nestjs/common'
import { ClientOptions, ClientProxy, ClientProxyFactory } from '@nestjs/microservices'
import { jsonToObject } from 'common'
import { lastValueFrom, Observer } from 'rxjs'

export class MicroserviceTestClient {
    static async create(option: ClientOptions) {
        const client = ClientProxyFactory.create(option)
        await client.connect()

        return new MicroserviceTestClient(client)
    }

    constructor(private client: ClientProxy) {}

    async close() {
        await this.client.close()
    }

    async send(cmd: string, payload: any) {
        return jsonToObject(await lastValueFrom(this.client.send({ cmd }, payload)))
    }

    async subscribe(
        cmd: string,
        payload: any,
        observerOrNext?: Partial<Observer<any>> | ((value: any) => void)
    ) {
        return this.client.send({ cmd }, payload).subscribe(observerOrNext)
    }

    async error(cmd: string, payload: any, status: HttpStatus) {
        const res = lastValueFrom(this.client.send({ cmd }, payload))
        await expect(res).rejects.toMatchObject({ status, message: expect.any(String) })
    }
}

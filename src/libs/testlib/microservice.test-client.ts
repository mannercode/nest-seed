import { ClientKafka, ClientOptions, ClientProxyFactory } from '@nestjs/microservices'
import { jsonToObject } from 'common'
import { lastValueFrom, Observer } from 'rxjs'

export class MicroserviceTestClient {
    static async create(option: ClientOptions, messages: string[] = []) {
        const client = ClientProxyFactory.create(option) as ClientKafka

        messages.forEach((msg) => client.subscribeToResponseOf(msg))

        await client.connect()

        return new MicroserviceTestClient(client)
    }

    constructor(public kafka: ClientKafka) {}

    async close() {
        await this.kafka.close()
    }

    async send(cmd: string, payload: any) {
        return jsonToObject(await lastValueFrom(this.kafka.send(cmd, payload)))
    }

    async subscribe(
        cmd: string,
        payload: any,
        observerOrNext?: Partial<Observer<any>> | ((value: any) => void)
    ) {
        return this.kafka.send(cmd, payload).subscribe(observerOrNext)
    }

    async error(cmd: string, payload: any, expected: any) {
        const res = lastValueFrom(this.kafka.send({ cmd }, payload))
        await expect(res).rejects.toMatchObject(expected)
    }
}

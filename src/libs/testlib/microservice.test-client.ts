import { ClientKafka, ClientOptions, ClientProxyFactory } from '@nestjs/microservices'
import { jsonToObject } from 'common'
import { lastValueFrom } from 'rxjs'

export class MicroserviceTestClient {
    static async create(option: ClientOptions, messages: string[] = []) {
        const kafka = ClientProxyFactory.create(option) as ClientKafka

        messages.forEach((msg) => kafka.subscribeToResponseOf(msg))

        await kafka.connect()

        return new MicroserviceTestClient(kafka)
    }

    constructor(public kafka: ClientKafka) {}

    async close() {
        await this.kafka.close()
    }

    async send(cmd: string, payload: any) {
        return jsonToObject(await lastValueFrom(this.kafka.send(cmd, payload)))
    }

    // async subscribe(
    //     cmd: string,
    //     payload: any,
    //     observerOrNext?: Partial<Observer<any>> | ((value: any) => void)
    // ) {
    //     return this.kafka.send(cmd, payload).subscribe(observerOrNext)
    // }

    async error(cmd: string, payload: any, expected: any) {
        const promise = lastValueFrom(this.kafka.send(cmd, payload))
        await expect(promise).rejects.toMatchObject(expected)
    }
}

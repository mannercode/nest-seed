import { DynamicModule, Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { ClientKafka, ClientsModule, ClientsProviderAsyncOptions } from '@nestjs/microservices'
import { jsonToObject } from 'common'
import { lastValueFrom, Observable } from 'rxjs'

@Injectable()
export class ClientProxyService implements OnModuleDestroy {
    constructor(private client: ClientKafka) {}

    static getToken(name: string) {
        return `ClientProxyService_${name}`
    }

    async onModuleDestroy() {
        await this.client.close()
    }

    // TODO {} 기본값 없애라
    send<T>(cmd: string, payload: any = {}): Observable<T> {
        return this.client.send(cmd, payload)
    }
}

/* istanbul ignore next */
export function InjectClientProxy(name: string): ParameterDecorator {
    return Inject(ClientProxyService.getToken(name))
}

export async function getProxyValue<T>(observer: Observable<T>): Promise<T> {
    return jsonToObject(await lastValueFrom(observer))
}

@Global()
@Module({})
export class ClientProxyModule {
    static registerAsync(
        options: ClientsProviderAsyncOptions & { messages?: string[] }
    ): DynamicModule {
        const { name, useFactory, inject, messages } = options
        const provider = {
            provide: ClientProxyService.getToken(name as string),
            useFactory: async (client: ClientKafka) => {
                messages?.forEach((msg) => client.subscribeToResponseOf(msg))
                await client.connect()
                return new ClientProxyService(client)
            },
            inject: [name]
        }

        return {
            module: ClientProxyModule,
            imports: [ClientsModule.registerAsync([{ name, useFactory, inject }])],
            providers: [provider],
            exports: [provider]
        }
    }
}

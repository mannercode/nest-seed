import { DynamicModule, Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { ClientProxy, ClientsModule, ClientsProviderAsyncOptions } from '@nestjs/microservices'
import { jsonToObject } from 'common'
import { lastValueFrom, Observable } from 'rxjs'

@Injectable()
export class ClientProxyService implements OnModuleDestroy {
    constructor(private client: ClientProxy) {}

    static getToken(name: string) {
        return `ClientProxyService_${name}`
    }

    async onModuleDestroy() {
        await this.client.close()
    }

    send<T>(cmd: string, payload: any = {}): Observable<T> {
        return this.client.send({ cmd }, payload)
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
    static registerAsync(options: ClientsProviderAsyncOptions): DynamicModule {
        const { name, useFactory, inject } = options
        const provider = {
            provide: ClientProxyService.getToken(name as string),
            useFactory: (client: ClientProxy) => new ClientProxyService(client),
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

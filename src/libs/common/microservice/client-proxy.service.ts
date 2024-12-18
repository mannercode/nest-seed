import { DynamicModule, Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { ClientProxy, ClientsModule, ClientsProviderAsyncOptions } from '@nestjs/microservices'
import { jsonToObject } from 'common'
import { lastValueFrom, Observable } from 'rxjs'

@Injectable()
export class ClientProxyService implements OnModuleDestroy {
    constructor(private client: ClientProxy) {}

    async onModuleDestroy() {
        await this.client.close()
    }

    send<T>(cmd: string, payload: any = {}): Observable<T> {
        return this.client.send({ cmd }, payload)
    }
}

export async function getProxyValue<T>(observer: Observable<T>): Promise<T> {
    return jsonToObject(await lastValueFrom(observer))
}

@Global()
@Module({})
export class ClientProxyModule {
    static registerAsync(options: ClientsProviderAsyncOptions): DynamicModule {
        const { name, useFactory, inject } = options
        return {
            module: ClientProxyModule,
            imports: [ClientsModule.registerAsync([{ name, useFactory, inject }])],
            providers: [
                {
                    provide: ClientProxyService,
                    useFactory: (client: ClientProxy) => new ClientProxyService(client),
                    inject: [name]
                }
            ],
            exports: [ClientProxyService]
        }
    }
}

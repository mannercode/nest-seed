import { DynamicModule, Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { ClientProxy, ClientsModule, ClientsProviderAsyncOptions } from '@nestjs/microservices'
import { lastValueFrom } from 'rxjs'
import { jsonToObject } from '../utils'

@Injectable()
export class ClientProxyService implements OnModuleDestroy {
    constructor(private client: ClientProxy) {}

    async onModuleDestroy() {
        await this.client.close()
    }

    send(cmd: string, payload: any) {
        return this.client.send({ cmd }, payload)
    }

    async getValue(cmd: string, payload: any) {
        return jsonToObject(await lastValueFrom(this.client.send({ cmd }, payload)))
    }
}

@Global()
@Module({})
export class ClientProxyModule {
    static registerAsync(options: ClientsProviderAsyncOptions): DynamicModule {
        const { name, useFactory, inject = [] } = options
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

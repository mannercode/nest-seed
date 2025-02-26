import { DynamicModule, Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { ClientProxy, ClientsModule, ClientsProviderAsyncOptions } from '@nestjs/microservices'
import { jsonToObject } from 'common'
import { lastValueFrom, Observable } from 'rxjs'

@Injectable()
export class ClientProxyService implements OnModuleDestroy {
    constructor(private proxy: ClientProxy) {}

    static getToken(name: string) {
        return `ClientProxyService_${name}`
    }

    async onModuleDestroy() {
        await this.proxy.close()
    }

    send<T>(cmd: string, payload: any): Observable<T> {
        // payload는 null일 수 없음
        return this.proxy.send(cmd, payload ?? '')
    }

    emit(event: string, payload: any) {
        // payload는 null일 수 없음
        return this.proxy.emit(event, payload ?? '')
    }
}

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
            useFactory: async (proxy: ClientProxy) => {
                return new ClientProxyService(proxy)
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

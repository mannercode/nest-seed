import {
    DynamicModule,
    Global,
    HttpException,
    Inject,
    Injectable,
    Module,
    OnModuleDestroy
} from '@nestjs/common'
import { ClientProxy, ClientsModule, ClientsProviderAsyncOptions } from '@nestjs/microservices'
import { catchError, lastValueFrom, Observable } from 'rxjs'
import { jsonToObject } from '../utils'

async function waitProxyValue<T>(observer: Observable<T>): Promise<T> {
    return lastValueFrom(
        observer.pipe(
            catchError((error) => {
                const { statusCode, ...rest } = error
                throw new HttpException(rest, statusCode)
            })
        )
    )
}

export async function getProxyValue<T>(observer: Observable<T>): Promise<T> {
    return jsonToObject(await waitProxyValue(observer))
}

@Injectable()
export class ClientProxyService implements OnModuleDestroy {
    constructor(private proxy: ClientProxy) {}

    static getToken(name: string) {
        return `ClientProxyService_${name}`
    }

    async onModuleDestroy() {
        await this.proxy.close()
    }

    getJson<T>(cmd: string, payload: any): Promise<T> {
        const observable = this.send<T>(cmd, payload)
        return getProxyValue(observable)
    }

    send<T>(cmd: string, payload: any): Observable<T> {
        // payload는 null일 수 없음
        return this.proxy.send(cmd, payload ?? '')
    }

    emit<T>(event: string, payload: any): Promise<T> {
        // payload는 null일 수 없음
        return waitProxyValue(this.proxy.emit<T>(event, payload ?? ''))
    }
}

export function InjectClientProxy(name: string): ParameterDecorator {
    return Inject(ClientProxyService.getToken(name))
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

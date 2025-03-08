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

// TODO 이거 적절한 위치?
export async function waitProxyValue<T>(observer: Observable<T>): Promise<T> {
    return lastValueFrom(
        observer.pipe(
            catchError((error) => {
                throw new HttpException(error.response, error.status)
            })
        )
    )
}

export async function getProxyValue<T>(observer: Observable<T>): Promise<T> {
    return jsonToObject(await waitProxyValue(observer))
}

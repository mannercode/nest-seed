import {
    DynamicModule,
    Global,
    HttpException,
    Inject,
    Injectable,
    Module,
    OnModuleDestroy
} from '@nestjs/common'
import { ClientProvider, ClientProxy, ClientsModule } from '@nestjs/microservices'
import { catchError, lastValueFrom, Observable, throwError } from 'rxjs'
import { jsonToObject } from '../utils'
import { orDefault } from '../validator'

async function waitProxyValue<T>(observer: Observable<T>): Promise<T> {
    return lastValueFrom(
        observer.pipe(
            catchError((error) => {
                const { status, response, options, message } = error

                if (status && response) {
                    return throwError(() => new HttpException(response, status, options))
                }

                return throwError(() => new Error(orDefault(message, 'Unknown error')))
            })
        )
    )
}

async function getProxyValue<T>(observer: Observable<T>): Promise<T> {
    return jsonToObject(await waitProxyValue(observer))
}

@Injectable()
export class ClientProxyService implements OnModuleDestroy {
    constructor(private readonly proxy: ClientProxy) {}

    static getName(name?: string) {
        return `ClientProxyService_${orDefault(name, 'default')}`
    }

    async onModuleDestroy() {
        await this.proxy.close()
    }

    getJson<T>(cmd: string, payload?: any): Promise<T> {
        const observable = this.send<T>(cmd, payload)
        return getProxyValue(observable)
    }

    send<T>(cmd: string, payload: any): Observable<T> {
        // send does not allow a null payload
        // send는 null payload를 허용하지 않음
        return this.proxy.send(cmd, orDefault(payload, ''))
    }

    emit(event: string, payload: any): Promise<void> {
        // emit does not allow a null payload
        // emit는 null payload를 허용하지 않음
        return waitProxyValue(this.proxy.emit<void>(event, orDefault(payload, '')))
    }
}

export function InjectClientProxy(name?: string): ParameterDecorator {
    return Inject(ClientProxyService.getName(name))
}

export type ClientProxyModuleOptions = {
    name?: string
    useFactory?: (...args: any[]) => Promise<ClientProvider> | ClientProvider
    inject?: any[]
}

@Global()
@Module({})
export class ClientProxyModule {
    static registerAsync(options: ClientProxyModuleOptions): DynamicModule {
        const { name, useFactory, inject } = options

        const clientName = orDefault(name, 'DefaultClientProxy')

        const provider = {
            provide: ClientProxyService.getName(name),
            useFactory: (proxy: ClientProxy) => new ClientProxyService(proxy),
            inject: [clientName]
        }

        return {
            module: ClientProxyModule,
            imports: [ClientsModule.registerAsync([{ name: clientName, useFactory, inject }])],
            providers: [provider],
            exports: [provider]
        }
    }
}

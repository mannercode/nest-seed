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
import { catchError, lastValueFrom, Observable, retry, throwError, timer } from 'rxjs'
import { jsonToObject } from '../utils'
import { Or } from '../validator'

async function waitProxyValue<T>(observer: Observable<T>): Promise<T> {
    return lastValueFrom(
        observer.pipe(
            catchError((error) => {
                const { status, response, options, message } = error

                if (status && response) {
                    return throwError(() => new HttpException(response, status, options))
                }

                return throwError(() => new Error(Or(message, 'Unknown error')))
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
        return `ClientProxyService_${Or(name, 'default')}`
    }

    async onModuleDestroy() {
        await this.proxy.close()
    }

    getJson<T>(cmd: string, payload?: any): Promise<T> {
        const observable = this.send<T>(cmd, payload)
        return getProxyValue(observable)
    }

    send<T>(cmd: string, payload: any): Observable<T> {
        const source$ = this.proxy.send<T>(cmd, Or(payload, ''))

        return source$.pipe(
            retry({
                count: 9,
                delay: (err, retryCount) => {
                    /* istanbul ignore next */
                    const msg = String(
                        err?.message ?? err?.response ?? err?.error ?? err?.toString?.() ?? ''
                    )

                    if (
                        /empty response/i.test(msg) ||
                        /no subscribers/i.test(msg) ||
                        /no responders/i.test(msg) ||
                        /no response from/i.test(msg)
                    ) {
                        return timer(retryCount * 50)
                    }
                    return throwError(() => err)
                },
                resetOnSuccess: true
            })
        )
    }

    emit(event: string, payload: any): Promise<void> {
        return waitProxyValue(this.proxy.emit<void>(event, Or(payload, '')))
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

        const clientName = Or(name, 'DefaultClientProxy')

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

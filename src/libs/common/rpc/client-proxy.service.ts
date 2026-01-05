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

    request<T>(cmd: string, payload?: any): Promise<T> {
        const observable = this.send<T>(cmd, payload)
        return getProxyValue(observable)
    }

    send<T>(cmd: string, payload: any): Observable<T> {
        const source$ = this.proxy.send<T>(cmd, Or(payload, ''))

        /**
         * Prevents the following error:
         * "Empty response. There are no subscribers listening to that message".
         *
         * In a NATS cluster, queue (subscription) creation may not be complete on all nodes yet.
         * If a message is published to a node that does not have the queue (subscription), the publish can fail.
         *
         * NATS 클러스터에서 모든 노드에 큐(구독) 생성이 아직 완료되지 않았을 수 있습니다.
         * 이때 큐(구독)가 없는 노드로 메시지를 발행(publish)하면 실패할 수 있습니다.
         */
        return source$.pipe(
            retry({
                count: 9,
                delay: (err, retryCount) => {
                    /* istanbul ignore next */
                    const msg = String(err?.message ?? err?.response ?? err?.toString?.() ?? '')

                    // TODO 테스트 추가
                    /* istanbul ignore next */
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

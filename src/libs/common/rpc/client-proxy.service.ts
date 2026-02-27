import { DynamicModule, OnModuleDestroy } from '@nestjs/common'
import { Global, HttpException, Inject, Injectable, Module } from '@nestjs/common'
import { ClientProvider, ClientProxy } from '@nestjs/microservices'
import { ClientsModule } from '@nestjs/microservices'
import { defaultTo } from 'lodash'
import { Observable } from 'rxjs'
import { catchError, defaultIfEmpty, lastValueFrom, retry, throwError, timer } from 'rxjs'
import { Json } from '../utils'

export type ClientProxyModuleOptions = {
    inject?: any[]
    name?: string
    useFactory: (...args: any[]) => ClientProvider | Promise<ClientProvider>
}

export function InjectClientProxy(name?: string): ParameterDecorator {
    return Inject(ClientProxyService.getName(name))
}

@Injectable()
export class ClientProxyService implements OnModuleDestroy {
    constructor(private readonly proxy: ClientProxy) {}

    static getName(name?: string) {
        return `ClientProxyService_${defaultTo(name, 'default')}`
    }

    emit(event: string, payload: any): Promise<void> {
        return waitProxyValue(this.proxy.emit<void>(event, defaultTo(payload, '')))
    }

    async onModuleDestroy() {
        await this.proxy.close()
    }

    request<T>(cmd: string, payload?: any): Promise<T> {
        const observable = this.send<T>(cmd, payload)
        return getProxyValue(observable)
    }

    send<T>(cmd: string, payload: any): Observable<T> {
        const source$ = this.proxy.send<T>(cmd, defaultTo(payload, ''))

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

                    if (
                        /empty response/i.test(msg) ||
                        /no subscribers/i.test(msg) ||
                        /no responders/i.test(msg) ||
                        /no response from/i.test(msg)
                    ) {
                        return timer(Math.min(50 * Math.pow(2, retryCount - 1), 2000))
                    }

                    return throwError(() => err)
                },
                resetOnSuccess: true
            })
        )
    }
}

async function getProxyValue<T>(observer: Observable<T>): Promise<T> {
    return Json.reviveIsoDates(await waitProxyValue(observer))
}

async function waitProxyValue<T>(observer: Observable<T>): Promise<T> {
    return lastValueFrom(
        observer.pipe(
            catchError((error) => {
                const { message, options, response, status } = error

                if (status && response) {
                    return throwError(() => new HttpException(response, status, options))
                }

                return throwError(() => new Error(defaultTo(message, 'Unknown error')))
            }),
            defaultIfEmpty(undefined as T)
        )
    )
}

@Global()
@Module({})
export class ClientProxyModule {
    static registerAsync(options: ClientProxyModuleOptions): DynamicModule {
        const { inject, name, useFactory } = options

        const clientName = defaultTo(name, 'DefaultClientProxy')

        const provider = {
            inject: [clientName],
            provide: ClientProxyService.getName(name),
            useFactory: (proxy: ClientProxy) => new ClientProxyService(proxy)
        }

        return {
            exports: [provider],
            imports: [ClientsModule.registerAsync([{ inject, name: clientName, useFactory }])],
            module: ClientProxyModule,
            providers: [provider]
        }
    }
}

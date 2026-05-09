import { DynamicModule, Inject, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common'
import { StringCodec, type NatsConnection, type Subscription } from 'nats'
import { defaultTo } from '../utils'
import { getNatsConnectionToken } from './nats.tokens'

type MessageHandler = (message: string) => void

type SubscriptionState = { sub: Subscription; handlers: Set<MessageHandler> }

/**
 * NATS 기반 pub/sub. cross-replica volatile broadcast (SSE bridging, cache
 * invalidation 등) 의 Redis Pub/Sub 을 대체한다.
 *
 * handler 는 등록된 순서대로 호출되고, 한 handler 의 예외가 뒤따르는
 * handler 의 실행을 막지 않는다.
 */
@Injectable()
export class NatsPubSubService implements OnModuleDestroy {
    private readonly logger = new Logger(NatsPubSubService.name)
    private readonly codec = StringCodec()
    private readonly subscriptions = new Map<string, SubscriptionState>()

    constructor(private readonly connection: NatsConnection) {}

    static getName(name?: string) {
        return `NatsPubSubService_${defaultTo(name, 'default')}`
    }

    async onModuleDestroy() {
        for (const { sub } of this.subscriptions.values()) {
            sub.unsubscribe()
        }
        this.subscriptions.clear()
    }

    async publish(subject: string, message: string): Promise<void> {
        this.connection.publish(subject, this.codec.encode(message))
        // 호출자가 await 했을 때 byte 가 wire 까지 나갔음을 보장하도록 flush 한다
        await this.connection.flush()
    }

    async subscribe(
        subject: string,
        handler: MessageHandler,
        options: { queue?: string } = {}
    ): Promise<void> {
        let state = this.subscriptions.get(subject)
        if (!state) {
            const sub = this.connection.subscribe(subject, { queue: options.queue })
            state = { handlers: new Set(), sub }
            this.subscriptions.set(subject, state)
            this.startConsumeLoop(subject, state)
            // SUB 프로토콜 메시지는 client → server 로 비동기 전송됨. flush 로
            // 서버 ack 를 받아야 "이후 publish 가 이 구독에 도달" 이 보장됨.
            // 안 하면 race 때문에 직후 publish 가 누락될 수 있음.
            await this.connection.flush()
        }

        state.handlers.add(handler)
    }

    async unsubscribe(subject: string, handler: MessageHandler): Promise<void> {
        const state = this.subscriptions.get(subject)
        if (!state) return

        state.handlers.delete(handler)
        if (state.handlers.size === 0) {
            state.sub.unsubscribe()
            this.subscriptions.delete(subject)
        }
    }

    private startConsumeLoop(subject: string, state: SubscriptionState) {
        // sub.unsubscribe() 가 호출되면 drain 된다. for-await 가 깔끔히
        // 빠져나오므로 별도의 cancellation 추적은 필요없다. iterator 가
        // throw 하면 (server disconnect, 예기치 못한 protocol error) loop
        // 가 조용히 끝나는데 — "트래픽 없음" 으로 위장되지 않도록 log 를
        // 남겨서 operator 가 멈춘 subscription 을 알아챌 수 있게 한다.
        void (async () => {
            try {
                for await (const msg of state.sub) {
                    const text = this.codec.decode(msg.data)
                    // 한 handler 의 throw 가 다른 handler 전달을 막지 않도록 각각 격리
                    for (const handler of state.handlers) {
                        try {
                            handler(text)
                        } catch {
                            /* swallow — handler 가 자체적으로 error 보고를 책임진다 */
                        }
                    }
                }
            } catch (err) {
                this.logger.error(
                    `NATS consume loop terminated unexpectedly (subject=${subject})`,
                    err
                )
            }
        })()
    }
}

export type NatsPubSubModuleOptions = { name?: string; natsName?: string }

export function InjectNatsPubSub(name?: string): ParameterDecorator {
    return Inject(NatsPubSubService.getName(name))
}

@Module({})
export class NatsPubSubModule {
    static register(options: NatsPubSubModuleOptions = {}): DynamicModule {
        const { name, natsName } = options

        const provider = {
            inject: [getNatsConnectionToken(natsName)],
            provide: NatsPubSubService.getName(name),
            useFactory: (connection: NatsConnection) => new NatsPubSubService(connection)
        }

        return { exports: [provider], module: NatsPubSubModule, providers: [provider] }
    }
}

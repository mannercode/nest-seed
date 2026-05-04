import { DynamicModule, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { StringCodec, type NatsConnection, type Subscription } from 'nats'
import { defaultTo } from '../utils'
import { getNatsConnectionToken } from './nats.tokens'

type MessageHandler = (message: string) => void

type SubscriptionState = { sub: Subscription; handlers: Set<MessageHandler> }

/**
 * NATS-backed pub/sub. Replaces Redis Pub/Sub for cross-replica volatile
 * broadcast (SSE bridging, cache invalidation, etc.).
 *
 * Handlers are invoked in the order they were registered; an exception in
 * one handler does not prevent later handlers from running.
 */
@Injectable()
export class NatsPubSubService implements OnModuleDestroy {
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
        // flush so caller can `await` and trust the byte made it onto the
        // wire before continuing
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
            this.startConsumeLoop(state)
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

    private startConsumeLoop(state: SubscriptionState) {
        // Drained when sub.unsubscribe() is called; the for-await exits
        // cleanly so we don't need explicit cancellation tracking.
        void (async () => {
            for await (const msg of state.sub) {
                const text = this.codec.decode(msg.data)
                // 한 handler 의 throw 가 다른 handler 전달을 막지 않도록 각각 격리
                for (const handler of state.handlers) {
                    try {
                        handler(text)
                    } catch {
                        /* swallow — handler is responsible for its own error reporting */
                    }
                }
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

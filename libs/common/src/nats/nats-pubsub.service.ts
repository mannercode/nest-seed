import { DynamicModule, Inject, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common'
import { StringCodec, type NatsConnection, type Subscription } from 'nats'
import { defaultTo } from '../utils'
import { getNatsConnectionToken } from './nats.tokens'

type MessageHandler = (message: string) => void

type SubscriptionState = {
    handlers: Set<MessageHandler>
    queue: string | undefined
    sub: Subscription
    subject: string
}

function getSubscriptionKey(subject: string, queue?: string) {
    return JSON.stringify([subject, queue ?? null])
}

// 같은 subject/queue의 핸들러는 등록 순서로 실행되며 예외가 나면 그 소비 루프가 중단된다.
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
        // 반환 전에 서버 왕복까지 확인한다.
        await this.connection.flush()
    }

    async subscribe(
        subject: string,
        handler: MessageHandler,
        options: { queue?: string } = {}
    ): Promise<void> {
        const key = getSubscriptionKey(subject, options.queue)
        let state = this.subscriptions.get(key)
        if (!state) {
            const sub = this.connection.subscribe(subject, { queue: options.queue })
            state = { handlers: new Set(), queue: options.queue, sub, subject }
            this.subscriptions.set(key, state)
            this.startConsumeLoop(state)
            // 서버가 SUB를 받기 전에 직후 발행한 메시지가 누락되지 않게 한다.
            await this.connection.flush()
        }

        state.handlers.add(handler)
    }

    async unsubscribe(subject: string, handler: MessageHandler): Promise<void> {
        for (const [key, state] of this.subscriptions) {
            if (state.subject !== subject) continue

            state.handlers.delete(handler)
            if (state.handlers.size === 0) {
                state.sub.unsubscribe()
                this.subscriptions.delete(key)
            }
        }
    }

    private startConsumeLoop(state: SubscriptionState) {
        // 비정상 종료는 무트래픽과 구분하기 어려우므로 기록하고, 외곽 catch로 rejection을 막는다.
        void (async () => {
            try {
                for await (const msg of state.sub) {
                    const text = this.codec.decode(msg.data)
                    for (const handler of state.handlers) {
                        handler(text)
                    }
                }
            } catch (err) {
                this.logger.error(
                    `NATS consume loop terminated unexpectedly (subject=${state.subject}, queue=${state.queue ?? 'none'})`,
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

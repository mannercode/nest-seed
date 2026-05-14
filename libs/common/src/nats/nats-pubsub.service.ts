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

/**
 * NATS 기반 pub/sub 서비스이다. 복제본 사이에 휘발성 메시지를 전달하는 경로
 * (SSE 연결, 캐시 무효화 등)를 맡는다.
 *
 * 같은 subject와 queue 설정을 공유하는 핸들러는 등록된 순서대로 호출된다.
 * 핸들러가 예외를 던지면 해당 구독의 소비 루프가 멈추고, 후속 메시지가
 * 더는 전달되지 않는다.
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
        // 호출자가 `await` 결과를 받는 시점에는 메시지가 서버로 전송되어 있어야 한다.
        // 그래서 `flush`로 확인한다.
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
            // SUB 메시지는 클라이언트에서 서버로 비동기로 전송된다. `flush`로
            // 서버 응답까지 받아야 "이제 발행한 메시지가 이 구독에 도달한다"가
            // 보장된다. 이 단계를 건너뛰면 구독 직후 발행한 메시지가
            // 가끔 누락된다.
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
        // `sub.unsubscribe()`가 호출되면 이터레이터가 정상 종료한다. `for await`가
        // 정상적으로 종료되므로 따로 취소 신호를 다룰 필요가 없다.
        // 서버 연결 끊김·프로토콜 오류·핸들러 예외 등으로 이터레이터가 던지면 소비 루프가
        // 멈춘다. 로그가 없으면 단순히 트래픽이 없는 상황과 구분하기 어려우므로
        // 구독 중단을 오류 로그로 남긴다. (외곽 catch는 fire-and-forget IIFE의
        // unhandled rejection을 막기 위한 경계이다.)
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

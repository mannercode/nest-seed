import { DynamicModule, Inject, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common'
import { StringCodec, type NatsConnection, type Subscription } from 'nats'
import { defaultTo } from '../utils'
import { getNatsConnectionToken } from './nats.tokens'

type MessageHandler = (message: string) => void

type SubscriptionState = { sub: Subscription; handlers: Set<MessageHandler> }

/**
 * NATS 기반 pub/sub 서비스입니다. 복제본 사이에 휘발성 메시지를 전달하는 경로
 * (SSE 연결, 캐시 무효화 등)를 맡습니다.
 *
 * 같은 subject의 핸들러는 등록된 순서대로 호출됩니다. 한 핸들러가 예외를
 * 던져도 뒤따르는 핸들러는 정상적으로 실행됩니다.
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
        // 호출자가 `await`로 결과를 기다린 시점에는 메시지가 서버까지
        // 빠져나가 있어야 합니다. 그래서 `flush`로 확인합니다.
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
            // SUB 메시지는 클라이언트에서 서버로 비동기로 흘러갑니다. `flush`로
            // 서버 응답까지 받아야 "이제 발행한 메시지가 이 구독에 도달한다"가
            // 보장됩니다. 이 단계를 건너뛰면 구독 직후 발행한 메시지가
            // 가끔 누락됩니다.
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
        // `sub.unsubscribe()`가 호출되면 이터레이터가 정상 종료합니다. `for await`가
        // 정상적으로 종료되므로 따로 취소 신호를 다룰 필요가 없습니다.
        // 서버 연결 끊김이나 프로토콜 오류로 이터레이터가 예외를 던지면 소비 루프가
        // 멈춥니다. 로그가 없으면 단순히 트래픽이 없는 상황과 구분하기 어려우므로
        // 구독 중단을 오류 로그로 남깁니다.
        void (async () => {
            try {
                for await (const msg of state.sub) {
                    const text = this.codec.decode(msg.data)
                    // 한 핸들러가 던진 예외가 같은 메시지를 받는 다른 핸들러까지
                    // 막지 않도록, 핸들러별로 try/catch로 격리합니다.
                    for (const handler of state.handlers) {
                        try {
                            handler(text)
                        } catch {
                            // 핸들러가 자체적으로 에러를 보고할 책임이 있다고 보고 여기서는 무시합니다.
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

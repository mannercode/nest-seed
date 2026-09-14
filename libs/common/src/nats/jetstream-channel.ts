import {
    AckPolicy,
    DeliverPolicy,
    DiscardPolicy,
    jetstream,
    jetstreamManager,
    ReplayPolicy,
    RetentionPolicy,
    StorageType,
    type JetStreamClient
} from '@nats-io/jetstream'
import { nanos } from '@nats-io/transport-node'
import type { NatsConnection } from './nats.types.js'
import { JsonUtil } from '../utils/index.js'

export type DurableMessage = {
    decode: () => unknown
    acknowledge: () => void
    retryAfter: (delayMs: number) => void
    discard: (reason: string) => void
    deliveryCount: number
    sequence: number
}

export type DurableMessages = AsyncIterable<DurableMessage> & { close: () => Promise<void> }

export type JetStreamChannelOptions = {
    streamName: string
    consumerName: string
    subject: string
    description: string
    maxAgeMs: number
    duplicateWindowMs: number
    maxBytes: number
    ackWaitMs: number
}

// 보존·중복 제거·명시적 ack를 사용하는 채널이다. 처리 성공과 ack의 원자성은 보장하지 않는다.
export class JetStreamChannel {
    private readonly client: JetStreamClient
    private initialization: Promise<void> | undefined

    constructor(
        private readonly connection: NatsConnection,
        private readonly options: JetStreamChannelOptions
    ) {
        this.client = jetstream(connection)
    }

    initialize(): Promise<void> {
        this.initialization ??= this.createResources()
        return this.initialization
    }

    async publish(payload: object, messageId: string): Promise<void> {
        await this.initialize()
        await this.client.publish(this.options.subject, JsonUtil.stringify(payload), {
            expect: { streamName: this.options.streamName },
            msgID: messageId
        })
    }

    async consume(): Promise<DurableMessages> {
        await this.initialize()
        const consumer = await this.client.consumers.get(
            this.options.streamName,
            this.options.consumerName
        )
        const messages = await consumer.consume({ max_messages: 1 })
        return {
            close: async () => {
                await messages.close()
            },
            async *[Symbol.asyncIterator]() {
                for await (const message of messages) {
                    yield {
                        decode: () => message.json(),
                        acknowledge: () => message.ack(),
                        retryAfter: (delayMs: number) => message.nak(delayMs),
                        discard: (reason: string) => message.term(reason),
                        deliveryCount: message.info.deliveryCount,
                        sequence: message.seq
                    }
                }
            }
        }
    }

    private async createResources(): Promise<void> {
        const options = this.options
        const manager = await jetstreamManager(this.connection)
        await manager.streams.add({
            description: options.description,
            discard: DiscardPolicy.New,
            duplicate_window: nanos(options.duplicateWindowMs),
            max_age: nanos(options.maxAgeMs),
            max_bytes: options.maxBytes,
            name: options.streamName,
            num_replicas: 1,
            retention: RetentionPolicy.Limits,
            storage: StorageType.File,
            subjects: [options.subject]
        })
        await manager.consumers.add(options.streamName, {
            ack_policy: AckPolicy.Explicit,
            ack_wait: nanos(options.ackWaitMs),
            deliver_policy: DeliverPolicy.All,
            durable_name: options.consumerName,
            filter_subject: options.subject,
            replay_policy: ReplayPolicy.Instant
        })
    }
}

import { getNatsConnectionToken, JsonUtil, type NatsConnection } from '@mannercode/common'
import {
    AckPolicy,
    DeliverPolicy,
    DiscardPolicy,
    jetstream,
    jetstreamManager,
    ReplayPolicy,
    RetentionPolicy,
    StorageType,
    type ConsumerMessages,
    type JetStreamClient
} from '@nats-io/jetstream'
import { nanos } from '@nats-io/transport-node'
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AppConfigService, NATS_CONNECTION_NAME } from '#config'

const EVENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const EVENT_DUPLICATE_WINDOW_MS = 10 * 60 * 1000
const NOTIFICATION_ACK_WAIT_MS = 30 * 1000

export const PURCHASE_EVENTS_MAX_BYTES = Symbol('PURCHASE_EVENTS_MAX_BYTES')
export const DEFAULT_PURCHASE_EVENTS_MAX_BYTES = 256 * 1024 * 1024

export const ticketPurchasedEventSchema = z.object({
    purchaseRecordId: z.string().min(1),
    ticketIds: z.array(z.string().min(1)),
    userId: z.string().min(1)
})

export type TicketPurchasedEvent = z.infer<typeof ticketPurchasedEventSchema>

// PROJECT_ID로 stream과 subject를 격리하고 구매 알림은 durable consumer가 담당한다.
@Injectable()
export class PurchaseEvents implements OnModuleInit {
    private readonly client: JetStreamClient
    private readonly connection: NatsConnection
    private readonly notificationConsumerName: string
    private readonly streamName: string
    private initialization: Promise<void> | undefined
    readonly subjects: { purchased: string }

    constructor(
        @Inject(getNatsConnectionToken(NATS_CONNECTION_NAME)) connection: NatsConnection,
        config: AppConfigService,
        @Inject(PURCHASE_EVENTS_MAX_BYTES) private readonly maxBytes: number
    ) {
        this.connection = connection
        this.client = jetstream(connection)
        this.subjects = { purchased: `${config.projectId}.purchase.ticketPurchased` }
        const resourceId = createHash('sha256')
            .update(config.projectId)
            .digest('hex')
            .slice(0, 24)
            .toUpperCase()
        this.streamName = `PURCHASE_EVENTS_${resourceId}`
        this.notificationConsumerName = `PURCHASE_NOTIFICATION_${resourceId}`
    }

    async onModuleInit() {
        await this.initialize()
    }

    async emitTicketPurchased(payload: TicketPurchasedEvent) {
        await this.initialize()
        await this.client.publish(this.subjects.purchased, JsonUtil.stringify(payload), {
            expect: { streamName: this.streamName },
            msgID: payload.purchaseRecordId
        })
    }

    async consumeNotifications(): Promise<ConsumerMessages> {
        await this.initialize()
        const consumer = await this.client.consumers.get(
            this.streamName,
            this.notificationConsumerName
        )
        return consumer.consume({ max_messages: 1 })
    }

    private initialize() {
        this.initialization ??= this.createResources()
        return this.initialization
    }

    private async createResources() {
        const manager = await jetstreamManager(this.connection)
        await manager.streams.add({
            description: 'Durable purchase completion events',
            discard: DiscardPolicy.New,
            duplicate_window: nanos(EVENT_DUPLICATE_WINDOW_MS),
            max_age: nanos(EVENT_MAX_AGE_MS),
            max_bytes: this.maxBytes,
            name: this.streamName,
            num_replicas: 1,
            retention: RetentionPolicy.Limits,
            storage: StorageType.File,
            subjects: [this.subjects.purchased]
        })
        await manager.consumers.add(this.streamName, {
            ack_policy: AckPolicy.Explicit,
            ack_wait: nanos(NOTIFICATION_ACK_WAIT_MS),
            deliver_policy: DeliverPolicy.All,
            durable_name: this.notificationConsumerName,
            filter_subject: this.subjects.purchased,
            replay_policy: ReplayPolicy.Instant
        })
    }
}

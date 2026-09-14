import {
    getNatsConnectionToken,
    JetStreamChannel,
    sha256,
    type NatsConnection,
    type DurableMessages
} from '@mannercode/common'
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
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

@Injectable()
export class PurchaseEvents implements OnModuleInit {
    private readonly channel: JetStreamChannel
    readonly subjects: { purchased: string }

    constructor(
        @Inject(getNatsConnectionToken(NATS_CONNECTION_NAME)) connection: NatsConnection,
        config: AppConfigService,
        @Inject(PURCHASE_EVENTS_MAX_BYTES) maxBytes: number
    ) {
        this.subjects = { purchased: config.projectId + '.purchase.ticketPurchased' }
        const resourceId = sha256(config.projectId, 'hex').slice(0, 24).toUpperCase()
        this.channel = new JetStreamChannel(connection, {
            streamName: 'PURCHASE_EVENTS_' + resourceId,
            consumerName: 'PURCHASE_NOTIFICATION_' + resourceId,
            subject: this.subjects.purchased,
            description: 'Durable purchase completion events',
            maxAgeMs: EVENT_MAX_AGE_MS,
            duplicateWindowMs: EVENT_DUPLICATE_WINDOW_MS,
            ackWaitMs: NOTIFICATION_ACK_WAIT_MS,
            maxBytes
        })
    }

    async onModuleInit() {
        await this.channel.initialize()
    }

    async emitTicketPurchased(payload: TicketPurchasedEvent) {
        await this.channel.publish(payload, payload.purchaseRecordId)
    }

    consumeNotifications(): Promise<DurableMessages> {
        return this.channel.consume()
    }
}

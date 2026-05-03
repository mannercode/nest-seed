import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PurchaseEvents, TicketPurchasedEvent } from '../purchase.events'

const QUEUE_GROUP = 'purchase-notification'

/**
 * Demo subscriber: "send a notification once per purchase, regardless of
 * how many replicas are running."
 *
 * Joining a NATS queue group means NATS picks exactly one instance from
 * the group to receive each message. With 4 replicas, a purchase emits
 * one event and the notification handler runs once total, not four times.
 *
 * Use this pattern for side effects that must NOT be amplified by the
 * replica count: outbound emails / SMS / external API calls / ledger
 * writes. For "every replica needs to know" (cache invalidation, hot
 * config reload) omit the queue option — see PurchaseEventLoggerService.
 *
 * `received` is exposed for the demo test so you can confirm the handler
 * fired without relying on logger spies. A real implementation would call
 * SendGrid / Twilio / etc and skip the array.
 */
@Injectable()
export class PurchaseNotificationService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PurchaseNotificationService.name)
    readonly received: TicketPurchasedEvent[] = []
    private readonly handler = (message: string) => {
        const event = JsonUtil.parse(message) as TicketPurchasedEvent
        this.received.push(event)
        this.logger.log('would send purchase confirmation', {
            userId: event.userId,
            ticketCount: event.ticketIds.length
        })
    }

    constructor(
        private readonly events: PurchaseEvents,
        @InjectNatsPubSub() private readonly natsPubSub: NatsPubSubService
    ) {}

    async onModuleInit() {
        await this.natsPubSub.subscribe(this.events.subjects.purchased, this.handler, {
            queue: QUEUE_GROUP
        })
    }

    async onModuleDestroy() {
        await this.natsPubSub.unsubscribe(this.events.subjects.purchased, this.handler)
    }
}

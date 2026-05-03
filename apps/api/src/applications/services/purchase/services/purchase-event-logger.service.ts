import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
    PurchaseEvents,
    TicketPurchaseCanceledEvent,
    TicketPurchasedEvent
} from '../purchase.events'

type LogEntry =
    | { kind: 'purchased'; event: TicketPurchasedEvent }
    | { kind: 'canceled'; event: TicketPurchaseCanceledEvent }

/**
 * Demo subscriber: "every replica observes every purchase event."
 *
 * No queue group → NATS broadcasts each message to all subscribers. With
 * 4 replicas the handler runs 4 times per event. That is the right
 * shape when each replica owns a per-process resource that must be kept
 * in sync — typical examples are in-memory caches, hot-reloaded config,
 * or local metrics gauges.
 *
 * For "exactly one replica handles each event" (notifications, ledger
 * updates) join a queue group — see PurchaseNotificationService.
 *
 * `entries` is exposed for the demo test. A real implementation would
 * mutate per-replica state (cache, gauge, etc.) and skip the array.
 */
@Injectable()
export class PurchaseEventLoggerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PurchaseEventLoggerService.name)
    readonly entries: LogEntry[] = []
    private readonly purchasedHandler = (message: string) => {
        const event = JsonUtil.parse(message) as TicketPurchasedEvent
        this.entries.push({ event, kind: 'purchased' })
        this.logger.log('purchase observed', {
            userId: event.userId,
            ticketCount: event.ticketIds.length
        })
    }
    private readonly canceledHandler = (message: string) => {
        const event = JsonUtil.parse(message) as TicketPurchaseCanceledEvent
        this.entries.push({ event, kind: 'canceled' })
        this.logger.log('purchase canceled', {
            userId: event.userId,
            ticketCount: event.ticketIds.length
        })
    }

    constructor(
        private readonly events: PurchaseEvents,
        @InjectNatsPubSub() private readonly natsPubSub: NatsPubSubService
    ) {}

    async onModuleInit() {
        await this.natsPubSub.subscribe(this.events.subjects.purchased, this.purchasedHandler)
        await this.natsPubSub.subscribe(this.events.subjects.canceled, this.canceledHandler)
    }

    async onModuleDestroy() {
        await this.natsPubSub.unsubscribe(this.events.subjects.purchased, this.purchasedHandler)
        await this.natsPubSub.unsubscribe(this.events.subjects.canceled, this.canceledHandler)
    }
}

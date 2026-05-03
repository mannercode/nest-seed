import { InjectNatsPubSub, NatsPubSubService } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { getProjectId } from 'config'

/**
 * Cross-replica purchase domain events.
 *
 * Subjects are namespaced by PROJECT_ID so parallel test workers don't see
 * one another's events. NATS pub/sub gives broadcast-volatile semantics by
 * default (every subscribed replica receives each message); subscribers
 * that want exactly-once-per-service can join a NATS queue group via the
 * `subscribe(..., { queue })` option.
 */
@Injectable()
export class PurchaseEvents {
    readonly subjects = {
        canceled: `${getProjectId()}.purchase.ticketPurchaseCanceled`,
        purchased: `${getProjectId()}.purchase.ticketPurchased`
    }

    constructor(@InjectNatsPubSub() private readonly natsPubSub: NatsPubSubService) {}

    async emitTicketPurchaseCanceled(payload: TicketPurchaseCanceledEvent) {
        await this.natsPubSub.publish(this.subjects.canceled, JSON.stringify(payload))
    }

    async emitTicketPurchased(payload: TicketPurchasedEvent) {
        await this.natsPubSub.publish(this.subjects.purchased, JSON.stringify(payload))
    }
}

export type TicketPurchasedEvent = { userId: string; ticketIds: string[] }
export type TicketPurchaseCanceledEvent = { userId: string; ticketIds: string[] }

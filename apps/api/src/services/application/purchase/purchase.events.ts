import { InjectNatsPubSub, NatsPubSubService } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { getProjectId } from 'config'

/**
 * 여러 replica 간의 purchase 도메인 이벤트.
 *
 * Subject 는 PROJECT_ID 로 namespace 가 분리되어 있어, 병렬 test worker 끼리
 * 서로의 이벤트를 보지 않는다. NATS pub/sub 은 기본적으로 broadcast-volatile
 * semantics 다 (구독 중인 모든 replica 가 각 메시지를 받는다). service 단위로
 * 정확히 한 번만 처리하고 싶다면 `subscribe(..., { queue })` 옵션으로 NATS
 * queue group 에 합류시킨다.
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

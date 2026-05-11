import { InjectNatsPubSub, NatsPubSubService } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { getProjectId } from 'config'

/**
 * 복제본 사이로 흐르는 구매 도메인 이벤트.
 *
 * subject 이름 앞에 `PROJECT_ID` 를 붙여서 namespace 를 나눈다. 그래서 병렬
 * 테스트 워커끼리 서로의 이벤트를 보지 않는다.
 *
 * NATS pub/sub 의 기본 동작은 broadcast 다. 구독 중인 모든 복제본이 각
 * 메시지를 한 번씩 받는다. 같은 이벤트를 서비스 단위로 정확히 한 번만 처리
 * 하고 싶으면 `subscribe(..., { queue })` 로 NATS queue group 에 들여 둔다.
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

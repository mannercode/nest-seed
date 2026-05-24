import { InjectNatsPubSub, NatsPubSubService } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { getProjectId } from 'config'

/**
 * 구매 도메인 이벤트를 복제본 사이에 전달한다.
 *
 * subject 이름 앞에 `PROJECT_ID`를 붙여 병렬 테스트 워커의 이벤트 공간을 분리한다.
 *
 * NATS pub/sub의 기본 동작은 브로드캐스트이다.
 * 구독 중인 모든 복제본이 각 메시지를 한 번씩 받는다.
 * 같은 이벤트를 큐 그룹 안의 복제본 하나만 처리하게 하려면 `subscribe(..., { queue })`로 NATS 큐 그룹에 등록한다.
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

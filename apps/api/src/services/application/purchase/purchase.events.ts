import { InjectNatsPubSub, NatsPubSubService } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { getProjectId } from 'config'

/**
 * 구매 도메인 이벤트를 복제본 사이에 전달합니다.
 *
 * subject 이름 앞에 `PROJECT_ID`를 붙여 병렬 테스트 워커의 이벤트 공간을 분리합니다.
 *
 * NATS pub/sub의 기본 동작은 브로드캐스트입니다. 구독 중인 모든 복제본이 각
 * 메시지를 한 번씩 받습니다. 같은 이벤트를 서비스 단위로 정확히 한 번만 처리
 * 해야 한다면 `subscribe(..., { queue })`로 NATS 큐 그룹에 등록합니다.
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

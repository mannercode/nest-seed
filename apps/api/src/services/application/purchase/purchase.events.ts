import { InjectNatsPubSub, NatsPubSubService } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { getProjectId } from 'config'

// PROJECT_ID로 테스트 이벤트를 격리한다. 구독자가 queue를 지정하지 않으면 모든 복제본에 전달된다.
@Injectable()
export class PurchaseEvents {
    readonly subjects = { purchased: `${getProjectId()}.purchase.ticketPurchased` }

    constructor(@InjectNatsPubSub() private readonly natsPubSub: NatsPubSubService) {}

    async emitTicketPurchased(payload: TicketPurchasedEvent) {
        await this.natsPubSub.publish(this.subjects.purchased, JSON.stringify(payload))
    }
}

export type TicketPurchasedEvent = { userId: string; ticketIds: string[] }

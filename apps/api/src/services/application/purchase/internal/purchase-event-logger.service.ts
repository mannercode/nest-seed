import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PurchaseEvents, TicketPurchasedEvent } from '../purchase.events.js'

// 큐 그룹을 지정하지 않아 구매 이벤트를 모든 API 복제본의 관측 로그에 남긴다.
@Injectable()
export class PurchaseEventLoggerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PurchaseEventLoggerService.name)
    private readonly purchasedHandler = (message: string) => {
        const event = JsonUtil.parse(message) as TicketPurchasedEvent
        this.logger.log('purchase observed', {
            dedupeKey: event.purchaseRecordId,
            purchaseRecordId: event.purchaseRecordId,
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
    }

    async onModuleDestroy() {
        await this.natsPubSub.unsubscribe(this.events.subjects.purchased, this.purchasedHandler)
    }
}

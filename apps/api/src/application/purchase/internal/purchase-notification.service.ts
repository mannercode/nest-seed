import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PurchaseEvents, TicketPurchasedEvent } from '../purchase.events'

const QUEUE_GROUP = 'purchase-notification'

/**
 * Demo subscriber: "replica 가 몇 개든 purchase 당 알림을 한 번만 보낸다".
 *
 * NATS queue group 에 합류하면 NATS 가 group 내 정확히 한 인스턴스를 골라
 * 메시지를 전달한다. replica 4 개라도 purchase 한 번이면 알림 handler 는
 * 전체에서 한 번만 실행된다.
 *
 * 외부 메일/SMS/외부 API 호출/ledger write 처럼 replica 수만큼 증폭되면 안 되는
 * side effect 에 이 패턴을 쓴다. "모든 replica 가 알아야 하는" 경우 (cache
 * invalidation, hot config reload) 는 queue 옵션을 빼면 된다.
 * PurchaseEventLoggerService 참고.
 */
@Injectable()
export class PurchaseNotificationService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PurchaseNotificationService.name)
    private readonly handler = (message: string) => {
        const event = JsonUtil.parse(message) as TicketPurchasedEvent
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

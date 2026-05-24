import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PurchaseEvents, TicketPurchasedEvent } from '../purchase.events'

const QUEUE_GROUP = 'purchase-notification'

/**
 * 같은 구매 이벤트를 복제본 하나만 처리해야 할 때 쓰는 예시 구독자이다.
 *
 * NATS 큐 그룹에 참여하면 NATS가 그룹 안의 인스턴스 하나에만 메시지를 전달한다.
 * 복제본이 4개라도 구매 한 건당 알림 핸들러는 전체에서 한 번만 실행된다.
 *
 * 메일·SMS·외부 API 호출·원장 기록처럼 복제본 수만큼 반복되면 안 되는 부수 효과에 이 패턴을 사용한다.
 * 반대로 모든 복제본이 알아야 하는 일(캐시 무효화, 핫리로드 설정 갱신)은 `queue` 옵션을 제외하면 된다.
 * `PurchaseEventLoggerService`가 그 예이다.
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

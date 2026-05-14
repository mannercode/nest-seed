import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
    PurchaseEvents,
    TicketPurchaseCanceledEvent,
    TicketPurchasedEvent
} from '../purchase.events'

/**
 * 모든 복제본이 같은 구매 이벤트를 받아야 할 때 쓰는 예시 구독자이다.
 *
 * 큐 그룹을 지정하지 않으면 NATS가 각 메시지를 모든 구독자에게 전달한다.
 * 복제본이 4개면 이벤트 하나마다 핸들러가 4번 실행된다. 복제본마다 가진
 * 로컬 상태를 모두 갱신해야 할 때 사용한다.
 * 인메모리 캐시 무효화, 핫리로드 설정 갱신, 로컬 메트릭 집계가 그 예이다.
 *
 * 반대로 같은 이벤트를 한 복제본만 처리해야 하는 일(알림 발송, 원장 기록)은
 * 큐 그룹을 사용한다. `PurchaseNotificationService`가 그 예이다.
 */
@Injectable()
export class PurchaseEventLoggerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PurchaseEventLoggerService.name)
    private readonly purchasedHandler = (message: string) => {
        const event = JsonUtil.parse(message) as TicketPurchasedEvent
        this.logger.log('purchase observed', {
            userId: event.userId,
            ticketCount: event.ticketIds.length
        })
    }
    private readonly canceledHandler = (message: string) => {
        const event = JsonUtil.parse(message) as TicketPurchaseCanceledEvent
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

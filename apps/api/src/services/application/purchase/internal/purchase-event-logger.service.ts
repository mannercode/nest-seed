import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
    PurchaseEvents,
    TicketPurchaseCanceledEvent,
    TicketPurchasedEvent
} from '../purchase.events'

/**
 * 모든 복제본이 같은 구매 이벤트를 받아야 하는 경우를 보여 주는 예시 구독자입니다.
 *
 * queue group을 지정하지 않으면 NATS가 각 메시지를 구독자 전체에 전달합니다.
 * 복제본이 4개면 한 이벤트마다 핸들러가 4번 실행됩니다. 복제본마다 가진
 * 로컬 상태를 모두 갱신해야 할 때 사용하는 형태입니다.
 * 인메모리 캐시 무효화, 핫리로드 설정 갱신, 로컬 메트릭 집계가 그 예입니다.
 *
 * 반대로 같은 이벤트를 한 복제본만 처리해야 하는 일(알림 발송, ledger
 * 업데이트)은 queue group을 사용합니다. `PurchaseNotificationService`가 그 예입니다.
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

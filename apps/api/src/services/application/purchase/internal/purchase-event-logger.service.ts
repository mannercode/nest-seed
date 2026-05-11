import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
    PurchaseEvents,
    TicketPurchaseCanceledEvent,
    TicketPurchasedEvent
} from '../purchase.events'

/**
 * 시드용 구독자다. "모든 복제본이 모든 구매 이벤트를 본다" 패턴을 보여 준다.
 *
 * queue group 을 지정하지 않으면 NATS 가 각 메시지를 구독자 전체에 그대로
 * 뿌린다. 복제본이 4 개면 한 이벤트마다 핸들러가 4 번 실행된다. 각 복제본
 * 안에 자기만의 자원이 있어서 모두가 동기화돼야 할 때 어울리는 형태다.
 * 인메모리 캐시 무효화, 핫리로드 설정 갱신, 로컬 메트릭 집계가 그 예다.
 *
 * 반대로 같은 이벤트를 한 복제본만 처리해야 하는 일(알림 발송, ledger
 * 업데이트)은 queue group 을 쓴다. `PurchaseNotificationService` 가 그 예다.
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

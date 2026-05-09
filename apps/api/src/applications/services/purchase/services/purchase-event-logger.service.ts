import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
    PurchaseEvents,
    TicketPurchaseCanceledEvent,
    TicketPurchasedEvent
} from '../purchase.events'

type LogEntry =
    | { kind: 'purchased'; event: TicketPurchasedEvent }
    | { kind: 'canceled'; event: TicketPurchaseCanceledEvent }

/**
 * Demo subscriber: "모든 replica 가 모든 purchase event 를 관찰한다".
 *
 * queue group 없음 → NATS 가 각 메시지를 모든 subscriber 에 broadcast 한다.
 * replica 4 개면 event 당 handler 가 4 번 실행된다. 각 replica 가 동기화되어야
 * 하는 process 단위 자원을 들고 있을 때 적합한 형태다. 대표 예: in-memory
 * cache, hot-reloaded config, local metrics gauge.
 *
 * "event 하나를 정확히 한 replica 만 처리" (알림, ledger 업데이트) 가 필요하면
 * queue group 에 합류시킨다. PurchaseNotificationService 참고.
 *
 * `entries` 는 demo test 용으로 노출된다. 실제 구현이라면 replica 단위 상태
 * (cache, gauge 등) 를 변경하고 배열은 두지 않는다.
 */
@Injectable()
export class PurchaseEventLoggerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PurchaseEventLoggerService.name)
    readonly entries: LogEntry[] = []
    private readonly purchasedHandler = (message: string) => {
        const event = JsonUtil.parse(message) as TicketPurchasedEvent
        this.entries.push({ event, kind: 'purchased' })
        this.logger.log('purchase observed', {
            userId: event.userId,
            ticketCount: event.ticketIds.length
        })
    }
    private readonly canceledHandler = (message: string) => {
        const event = JsonUtil.parse(message) as TicketPurchaseCanceledEvent
        this.entries.push({ event, kind: 'canceled' })
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

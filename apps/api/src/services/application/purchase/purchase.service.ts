import { CacheService, InjectCache } from '@mannercode/common'
import { ConflictException, Injectable, Logger } from '@nestjs/common'
import { PurchaseItemType, PurchaseRecordsService, TicketsService, TicketStatus } from 'core'
import { PaymentsService } from 'infrastructure'
import { CreatePurchaseDto } from './dtos'
import { PurchaseErrors } from './errors'
import { TicketPurchaseService } from './internal'

const PURCHASE_LOCK_TTL_MS = 5 * 60 * 1000
const PURCHASE_LOCK_WAIT_MS = 10 * 60 * 1000

@Injectable()
export class PurchaseService {
    private readonly logger = new Logger(PurchaseService.name)

    constructor(
        private readonly purchaseRecordsService: PurchaseRecordsService,
        private readonly paymentsService: PaymentsService,
        private readonly ticketPurchaseService: TicketPurchaseService,
        private readonly ticketsService: TicketsService,
        @InjectCache('purchase') private readonly cache: CacheService
    ) {}

    async processPurchase(createDto: CreatePurchaseDto) {
        this.logger.log('processPurchase', { userId: createDto.userId })

        const ticketIds = createDto.purchaseItems
            .filter((item) => item.type === PurchaseItemType.Tickets)
            .map((item) => item.itemId)
        const lockKey = `tickets:${ticketIds.sort().join(',')}`

        // 선점은 결제가 끝난 뒤에도 바로 해제되지 않으므로, 같은 티켓 묶음에 대한
        // 동시 결제를 직렬화해야 한다. 락 안에서 가용성을 다시 확인하면 첫 결제가
        // 티켓을 `Sold`로 바꾼 뒤 들어온 결제는 결제 기록을 만들기 전에 거절된다.
        return this.cache.withLockBlocking(
            lockKey,
            PURCHASE_LOCK_TTL_MS,
            () => this.processPurchaseLocked(createDto, ticketIds),
            { waitMs: PURCHASE_LOCK_WAIT_MS }
        )
    }

    private async processPurchaseLocked(createDto: CreatePurchaseDto, ticketIds: string[]) {
        const tickets = await this.ticketsService.getMany(ticketIds)
        const unavailable = tickets.filter((t) => t.status !== TicketStatus.Available)
        if (unavailable.length > 0) {
            throw new ConflictException(PurchaseErrors.AlreadySold(unavailable.map((t) => t.id)))
        }

        await this.ticketPurchaseService.validatePurchase(createDto)

        const payment = await this.paymentsService.create({
            amount: createDto.totalPrice,
            userId: createDto.userId
        })
        this.logger.log('processPurchase createPayment completed', { paymentId: payment.id })

        let purchaseRecord
        try {
            purchaseRecord = await this.purchaseRecordsService.create({
                ...createDto,
                paymentId: payment.id
            })
            this.logger.log('processPurchase createPurchaseRecord completed', {
                purchaseRecordId: purchaseRecord.id
            })
        } catch (error) {
            this.logger.warn('processPurchase compensation: cancelPayment', {
                paymentId: payment.id
            })
            await this.paymentsService.cancel(payment.id)
            throw error
        }

        try {
            await this.ticketPurchaseService.completePurchase(createDto)
            this.logger.log('processPurchase completed', { purchaseRecordId: purchaseRecord.id })
            return purchaseRecord
        } catch (error) {
            this.logger.warn(
                'processPurchase compensation: rollbackPurchase, deletePurchaseRecord, cancelPayment',
                { paymentId: payment.id, purchaseRecordId: purchaseRecord.id }
            )
            // 보상 단계 하나가 실패해도 뒤따르는 단계는 계속 시도해야 부분 정리
            // 상태가 줄어든다. 실패한 보상은 로그로 남겨 운영자가 수동 정리할
            // 수 있게 하고, 원래 오류는 그대로 호출자에게 던진다. 정합성이 더
            // 중요한 흐름은 Temporal 사가(`showtime-creation`)를 참고한다.
            await this.tryCompensate('rollbackPurchase', () =>
                this.ticketPurchaseService.rollbackPurchase(createDto)
            )
            await this.tryCompensate('deletePurchaseRecord', () =>
                this.purchaseRecordsService.deleteMany([purchaseRecord.id])
            )
            await this.tryCompensate('cancelPayment', () => this.paymentsService.cancel(payment.id))
            throw error
        }
    }

    private async tryCompensate(step: string, action: () => Promise<unknown>) {
        try {
            await action()
        } catch (error) {
            this.logger.error(`compensation step failed: ${step}`, { error })
        }
    }
}

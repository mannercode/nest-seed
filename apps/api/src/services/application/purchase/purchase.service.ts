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

    async processPurchase(createDto: CreatePurchaseDto, userId: string) {
        this.logger.log('processPurchase', { userId })

        const ticketIds = createDto.purchaseItems
            .filter((item) => item.type === PurchaseItemType.Tickets)
            .map((item) => item.itemId)
        const lockKey = `tickets:${ticketIds.sort().join(',')}`

        // 같은 티켓 묶음의 동시 결제를 직렬화해, 뒤따른 결제가 결제 기록을 만들기 전에 거절되도록 한다.
        // 단, 겹치지만 다른 묶음은 락 키가 달라 직렬화되지 않는다.
        // 이중 판매 방지 자체는 락이 아니라 `transitStatusMany`의 원자 전이(Available→Sold)가 보장한다.
        // 락은 불필요한 결제 생성·보상을 줄이는 최적화다.
        return this.cache.withLockBlocking(
            lockKey,
            PURCHASE_LOCK_TTL_MS,
            () => this.processPurchaseLocked(createDto, userId, ticketIds),
            { waitMs: PURCHASE_LOCK_WAIT_MS }
        )
    }

    private async processPurchaseLocked(
        createDto: CreatePurchaseDto,
        userId: string,
        ticketIds: string[]
    ) {
        const tickets = await this.ticketsService.getMany(ticketIds)
        const unavailable = tickets.filter((t) => t.status !== TicketStatus.Available)
        if (unavailable.length > 0) {
            throw new ConflictException(PurchaseErrors.AlreadySold(unavailable.map((t) => t.id)))
        }

        await this.ticketPurchaseService.validatePurchase(createDto, userId)

        const payment = await this.paymentsService.create({ amount: createDto.totalPrice, userId })
        this.logger.log('processPurchase createPayment completed', { paymentId: payment.id })

        let purchaseRecord
        try {
            purchaseRecord = await this.purchaseRecordsService.create({
                ...createDto,
                userId,
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
            await this.ticketPurchaseService.completePurchase(createDto, userId)
            this.logger.log('processPurchase completed', { purchaseRecordId: purchaseRecord.id })
            return purchaseRecord
        } catch (error) {
            this.logger.warn('processPurchase compensation: deletePurchaseRecord, cancelPayment', {
                paymentId: payment.id,
                purchaseRecordId: purchaseRecord.id
            })
            // 모든 보상을 시도하되 실패는 기록하고 원래 구매 오류를 보존한다.
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

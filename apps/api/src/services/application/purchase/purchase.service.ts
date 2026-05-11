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
        const lockKey = `tickets:${[...ticketIds].sort().join(',')}`

        // 같은 티켓 묶음에 대한 동시 결제를 한 번에 하나씩만 처리한다.
        // `validatePurchase` 는 사용자가 그 티켓을 hold 하고 있는지만 본다.
        // 결제가 끝나도 hold 가 풀리지 않으므로, 락이 없으면 동시에 들어온
        // 결제 여러 건이 모두 검증을 통과해 각자 결제 레코드를 만든다.
        // 락 안에서 가용성을 다시 확인하면, 한 번 `Sold` 로 바뀐 뒤에는
        // 다음 결제가 결제 단계에 닿기 전에 거절된다.
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
            await this.ticketPurchaseService.rollbackPurchase(createDto)
            await this.purchaseRecordsService.deleteMany([purchaseRecord.id])
            await this.paymentsService.cancel(payment.id)
            throw error
        }
    }
}

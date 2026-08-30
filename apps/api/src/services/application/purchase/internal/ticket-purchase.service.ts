import { DateUtil, uniq } from '@mannercode/common'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { AppConfigService } from '#config'
import {
    PurchaseItemDto,
    ShowtimeDto,
    ShowtimesService,
    TicketHoldingService,
    TicketsService,
    PurchaseItemType
} from '#core'
import { CreatePurchaseDto } from '../dtos/index.js'
import { PurchaseErrors } from '../errors.js'

@Injectable()
export class TicketPurchaseService {
    private readonly logger = new Logger(TicketPurchaseService.name)

    constructor(
        private readonly ticketsService: TicketsService,
        private readonly showtimesService: ShowtimesService,
        private readonly ticketHoldingService: TicketHoldingService,
        private readonly config: AppConfigService
    ) {}

    async claimPurchase(
        createDto: CreatePurchaseDto,
        userId: string,
        purchaseRecordId: string
    ): Promise<void> {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Tickets
        )
        const ticketIds = ticketItems.map((item) => item.itemId)
        const tickets = await this.ticketsService.getMany(ticketIds)

        this.logger.log('claimPurchase', { userId, ticketCount: ticketIds.length })

        // 사전 hold 검증 이후 TTL이 만료될 수 있으므로 결제 전에 실제 ticket 키 owner를
        // purchaseRecordId로 claim한다. showtime별 Lua 원자성은 TicketHoldingService가 보장한다.
        const claimed = await this.ticketHoldingService.claimTicketsForPurchase({
            purchaseRecordId,
            tickets,
            userId
        })
        if (!claimed) throw new BadRequestException(PurchaseErrors.NotHeld())
    }

    async completePurchase<T>(
        createDto: CreatePurchaseDto,
        purchaseRecordId: string,
        completeDurably: (ticketIds: string[]) => Promise<T>
    ): Promise<T> {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Tickets
        )
        const ticketIds = ticketItems.map((item) => item.itemId)
        const tickets = await this.ticketsService.getMany(ticketIds)

        this.logger.log('completePurchase', { ticketCount: ticketIds.length })

        // 결제가 진행되는 동안 claim TTL이 만료됐을 수 있다. 판매 직전 owner를 Lua에서
        // 확인하면서 TTL을 연장해, 다른 고객의 새 hold를 Mongo sale이 빼앗지 않게 한다.
        const confirmed = await this.ticketHoldingService.confirmPurchaseClaims(
            purchaseRecordId,
            tickets
        )
        if (!confirmed) throw new BadRequestException(PurchaseErrors.NotHeld())

        // 티켓 판매와 구매 상태 CAS는 호출자가 같은 Mongo 트랜잭션으로 묶는다.
        // Redis 확인·정리를 callback 밖에 둬 MongoDB의 transaction callback 재시도에
        // 비트랜잭션 부수 효과가 반복되지 않게 한다.
        const completed = await completeDurably(ticketIds)

        try {
            await this.ticketHoldingService.releasePurchaseClaims(purchaseRecordId, tickets)
        } catch (error) {
            // 판매 소유권은 MongoDB에 확정됐다. Redis claim은 TTL로 사라지므로 구매 전체를
            // 되돌리지 않고 진단만 남긴다.
            this.logger.warn('completePurchase claim cleanup failed', { error, purchaseRecordId })
        }

        return completed
    }

    async compensatePurchase(createDto: CreatePurchaseDto, purchaseRecordId: string) {
        const ticketIds = createDto.purchaseItems
            .filter((item) => item.type === PurchaseItemType.Tickets)
            .map((item) => item.itemId)
        const tickets = await this.ticketsService.getMany(ticketIds)

        await this.ticketsService.releaseOwnedPurchaseForCompensation(ticketIds, purchaseRecordId)
        await this.ticketHoldingService.releasePurchaseClaims(purchaseRecordId, tickets)
    }

    async validatePurchase(createDto: CreatePurchaseDto, userId: string): Promise<void> {
        this.logger.log('validatePurchase', { userId })
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Tickets
        )
        const showtimes = await this.getShowtimes(ticketItems)

        this.validateTicketCount(ticketItems)
        this.validateTotalPrice(createDto, ticketItems)
        this.validatePurchaseTime(showtimes)
        await this.validateHeldTickets(userId, showtimes, ticketItems)
    }

    private async getShowtimes(ticketItems: PurchaseItemDto[]) {
        const ticketIds = ticketItems.map((item) => item.itemId)
        const tickets = await this.ticketsService.getMany(ticketIds)
        const showtimeIds = tickets.map((ticket) => ticket.showtimeId)
        const uniqueShowtimeIds = uniq(showtimeIds)
        const showtimes = await this.showtimesService.getMany(uniqueShowtimeIds)

        return showtimes
    }

    private async validateHeldTickets(
        userId: string,
        showtimes: ShowtimeDto[],
        ticketItems: PurchaseItemDto[]
    ) {
        const heldByShowtime = await Promise.all(
            showtimes.map((showtime) =>
                this.ticketHoldingService.searchHeldTicketIds(showtime.id, userId)
            )
        )
        const heldTicketIds = heldByShowtime.flat()

        const areAllTicketsHeld = ticketItems.every((ticketItem) =>
            heldTicketIds.includes(ticketItem.itemId)
        )

        if (!areAllTicketsHeld) {
            throw new BadRequestException(PurchaseErrors.NotHeld())
        }
    }

    private validatePurchaseTime(showtimes: ShowtimeDto[]) {
        const cutoffMinutes = this.config.ticket.purchaseCutoffMinutes

        for (const { startTime } of showtimes) {
            const purchaseWindowCloseTime = DateUtil.add({
                base: startTime,
                minutes: -cutoffMinutes
            })

            if (DateUtil.isBefore(purchaseWindowCloseTime, DateUtil.now())) {
                throw new BadRequestException(
                    PurchaseErrors.WindowClosed(
                        cutoffMinutes,
                        purchaseWindowCloseTime.toString(),
                        startTime.toString()
                    )
                )
            }
        }
    }

    private validateTicketCount(ticketItems: PurchaseItemDto[]) {
        const maxPerPurchase = this.config.ticket.maxPerPurchase

        if (maxPerPurchase < ticketItems.length) {
            throw new BadRequestException(PurchaseErrors.LimitExceeded(maxPerPurchase))
        }
    }

    private validateTotalPrice(createDto: CreatePurchaseDto, ticketItems: PurchaseItemDto[]) {
        // 서버 정가로 다시 계산해 클라이언트가 결제 금액을 정하지 못하게 한다.
        const expectedPrice = ticketItems.length * this.config.ticket.price

        if (createDto.totalPrice !== expectedPrice) {
            throw new BadRequestException(
                PurchaseErrors.TotalPriceMismatch(expectedPrice, createDto.totalPrice)
            )
        }
    }
}

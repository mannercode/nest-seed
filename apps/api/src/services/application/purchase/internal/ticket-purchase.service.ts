import { DateUtil, ensure } from '@mannercode/common'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { AppConfigService } from '#config'
import {
    PurchaseItemDto,
    ShowtimeDto,
    ShowtimesService,
    TicketHoldingService,
    TicketDto,
    TicketsService
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
        const ticketItems = createDto.purchaseItems
        const ticketIds = ticketItems.map((item) => item.itemId)
        const tickets = await this.ticketsService.getMany(ticketIds)

        this.logger.log('claimPurchase', { userId, ticketCount: ticketIds.length })

        // 사전 선점 확인 이후에도 TTL이 만료될 수 있으므로, 결제 전에 티켓 키의 소유자를
        // 사용자 ID에서 purchaseRecordId로 바꾼다. 같은 상영의 요청 티켓을 Lua 한 번으로 처리한다.
        const claimed = await this.ticketHoldingService.claimTicketsForPurchase({
            purchaseRecordId,
            showtimeId: this.getShowtimeId(tickets),
            ticketIds,
            userId
        })
        if (!claimed) throw new BadRequestException(PurchaseErrors.NotHeld())
    }

    async completePurchase<T>(
        createDto: CreatePurchaseDto,
        purchaseRecordId: string,
        completeDurably: (ticketIds: string[]) => Promise<T>
    ): Promise<T> {
        const ticketItems = createDto.purchaseItems
        const ticketIds = ticketItems.map((item) => item.itemId)
        const tickets = await this.ticketsService.getMany(ticketIds)

        this.logger.log('completePurchase', { ticketCount: ticketIds.length })

        // 결제 중 선점 기한이 만료됐을 수 있으므로 판매 직전에 소유자를 확인하고 TTL을 연장한다.
        // 다른 고객이 새로 선점한 티켓을 기존 구매가 판매 처리하지 않도록 Lua에서 한 번에 확인한다.
        const claim = { purchaseRecordId, showtimeId: this.getShowtimeId(tickets), ticketIds }
        const confirmed = await this.ticketHoldingService.confirmPurchaseClaims(claim)
        if (!confirmed) throw new BadRequestException(PurchaseErrors.NotHeld())

        // 호출자는 티켓 판매와 구매 상태의 조건부 갱신을 같은 MongoDB 트랜잭션으로 묶는다.
        // Redis 확인·정리는 트랜잭션 콜백 밖에서 실행해, 드라이버가 콜백을 재시도해도 반복되지 않게 한다.
        const completed = await completeDurably(ticketIds)

        try {
            await this.ticketHoldingService.releasePurchaseClaims(claim)
        } catch (error) {
            // 판매 소유권은 MongoDB에 확정됐다. Redis claim은 TTL로 사라지므로 구매 전체를
            // 되돌리지 않고 진단만 남긴다.
            this.logger.warn('completePurchase claim cleanup failed', { error, purchaseRecordId })
        }

        return completed
    }

    async compensatePurchase(createDto: CreatePurchaseDto, purchaseRecordId: string) {
        const ticketIds = createDto.purchaseItems.map((item) => item.itemId)
        const tickets = await this.ticketsService.getMany(ticketIds)

        await this.ticketHoldingService.releasePurchaseClaims({
            purchaseRecordId,
            showtimeId: this.getShowtimeId(tickets),
            ticketIds
        })
    }

    async validatePurchase(createDto: CreatePurchaseDto, userId: string): Promise<void> {
        this.logger.log('validatePurchase', { userId })
        const ticketItems = createDto.purchaseItems
        const showtime = await this.getShowtime(ticketItems)

        this.validateTicketCount(ticketItems)
        this.validateTotalPrice(createDto, ticketItems)
        this.validatePurchaseTime(showtime)
        await this.validateHeldTickets(userId, showtime.id, ticketItems)
    }

    private async getShowtime(ticketItems: PurchaseItemDto[]) {
        const ticketIds = ticketItems.map((item) => item.itemId)
        const tickets = await this.ticketsService.getMany(ticketIds)
        // getMany는 같은 저장소 ID를 한 번만 반환하므로 대소문자만 다른 ID도 중복으로 본다.
        if (tickets.length !== ticketIds.length) {
            throw new BadRequestException(PurchaseErrors.DuplicateTickets())
        }
        const showtimeId = this.getShowtimeId(tickets)
        const showtimes = await this.showtimesService.getMany([showtimeId])

        return ensure(showtimes[0])
    }

    private getShowtimeId(tickets: TicketDto[]) {
        const { showtimeId } = ensure(tickets[0])
        if (tickets.some((ticket) => ticket.showtimeId !== showtimeId)) {
            throw new BadRequestException(PurchaseErrors.MultipleShowtimes())
        }
        return showtimeId
    }

    private async validateHeldTickets(
        userId: string,
        showtimeId: string,
        ticketItems: PurchaseItemDto[]
    ) {
        const heldTicketIds = await this.ticketHoldingService.searchHeldTicketIds(
            showtimeId,
            userId
        )

        const areAllTicketsHeld = ticketItems.every((ticketItem) =>
            heldTicketIds.includes(ticketItem.itemId)
        )

        if (!areAllTicketsHeld) {
            throw new BadRequestException(PurchaseErrors.NotHeld())
        }
    }

    private validatePurchaseTime({ startTime }: ShowtimeDto) {
        const cutoffMinutes = this.config.ticket.purchaseCutoffMinutes

        const purchaseWindowCloseTime = DateUtil.add({ base: startTime, minutes: -cutoffMinutes })

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

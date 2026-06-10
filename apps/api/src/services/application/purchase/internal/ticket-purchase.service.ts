import { DateUtil, uniq } from '@mannercode/common'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { AppConfigService } from 'config'
import {
    PurchaseItemDto,
    ShowtimeDto,
    ShowtimesService,
    TicketHoldingService,
    TicketsService,
    PurchaseItemType,
    TicketStatus
} from 'core'
import { CreatePurchaseDto } from '../dtos'
import { PurchaseErrors } from '../errors'
import { PurchaseEvents } from '../purchase.events'

@Injectable()
export class TicketPurchaseService {
    private readonly logger = new Logger(TicketPurchaseService.name)

    constructor(
        private readonly ticketsService: TicketsService,
        private readonly showtimesService: ShowtimesService,
        private readonly ticketHoldingService: TicketHoldingService,
        private readonly events: PurchaseEvents,
        private readonly config: AppConfigService
    ) {}

    async completePurchase(createDto: CreatePurchaseDto, userId: string): Promise<void> {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Tickets
        )
        const ticketIds = ticketItems.map((item) => item.itemId)

        this.logger.log('completePurchase', { userId, ticketCount: ticketIds.length })

        // Available인 티켓만 원자적으로 Sold로 바꾼다. 하나라도 어긋나면 아무것도 팔리지 않으므로(409),
        // 이 호출이 성공했다는 사실이 곧 "이 결제가 이 티켓들을 팔았다"는 소유의 근거가 된다.
        await this.ticketsService.transitStatusMany(
            ticketIds,
            TicketStatus.Available,
            TicketStatus.Sold
        )

        try {
            await this.events.emitTicketPurchased({ userId, ticketIds })
        } catch (error) {
            // 전이는 성공했지만 발행이 실패했다. 방금 이 결제가 판매한 티켓만 되돌린다.
            // Sold는 다른 결제가 건드릴 수 없는 상태라, from=Sold 조건부 전이로 소유가 보장된다.
            this.logger.warn('completePurchase compensation: revert tickets', {
                userId,
                ticketCount: ticketIds.length
            })
            await this.ticketsService.transitStatusMany(
                ticketIds,
                TicketStatus.Sold,
                TicketStatus.Available
            )
            throw error
        }
    }

    async validatePurchase(createDto: CreatePurchaseDto, userId: string): Promise<void> {
        this.logger.log('validatePurchase', { userId })
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Tickets
        )
        const showtimes = await this.getShowtimes(ticketItems)

        this.validateTicketCount(ticketItems)
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

            if (purchaseWindowCloseTime.getTime() < DateUtil.now().getTime()) {
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
}

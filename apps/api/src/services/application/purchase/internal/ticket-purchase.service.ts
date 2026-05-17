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

    async completePurchase(createDto: CreatePurchaseDto): Promise<void> {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Tickets
        )
        const ticketIds = ticketItems.map((item) => item.itemId)

        this.logger.log('completePurchase', {
            userId: createDto.userId,
            ticketCount: ticketIds.length
        })

        await this.ticketsService.updateStatusMany(ticketIds, TicketStatus.Sold)

        await this.events.emitTicketPurchased({ userId: createDto.userId, ticketIds })
    }

    async rollbackPurchase(createDto: CreatePurchaseDto): Promise<void> {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Tickets
        )
        const ticketIds = ticketItems.map((item) => item.itemId)

        this.logger.warn('rollbackPurchase', {
            userId: createDto.userId,
            ticketCount: ticketIds.length
        })

        // 보상 흐름은 어디서 멈췄는지에 따라 티켓이 이미 Available일 수 있다.
        // `updateStatusMany`는 동일 상태로의 전이를 충돌로 보므로 Sold인 티켓만
        // 골라 되돌린다.
        const tickets = await this.ticketsService.getMany(ticketIds)
        const soldTicketIds = tickets
            .filter((ticket) => ticket.status === TicketStatus.Sold)
            .map((ticket) => ticket.id)
        if (soldTicketIds.length > 0) {
            await this.ticketsService.updateStatusMany(soldTicketIds, TicketStatus.Available)
        }

        await this.events.emitTicketPurchaseCanceled({ userId: createDto.userId, ticketIds })
    }

    async validatePurchase(createDto: CreatePurchaseDto): Promise<void> {
        this.logger.log('validatePurchase', { userId: createDto.userId })
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Tickets
        )
        const showtimes = await this.getShowtimes(ticketItems)

        this.validateTicketCount(ticketItems)
        this.validatePurchaseTime(showtimes)
        await this.validateHeldTickets(createDto.userId, showtimes, ticketItems)
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

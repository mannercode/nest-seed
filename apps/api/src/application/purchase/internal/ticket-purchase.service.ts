import { DateUtil, uniq } from '@mannercode/common'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import {
    PurchaseItemDto,
    ShowtimeDto,
    ShowtimesService,
    TicketHoldingService,
    TicketsService,
    PurchaseItemType,
    TicketStatus
} from 'core'
import { AppConfigService } from 'shared'
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

        await this.ticketsService.updateStatusMany(ticketIds, TicketStatus.Available)

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
        const heldTicketIds: string[] = []

        for (const showtime of showtimes) {
            const ticketIds = await this.ticketHoldingService.searchHeldTicketIds(
                showtime.id,
                userId
            )
            heldTicketIds.push(...ticketIds)
        }

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

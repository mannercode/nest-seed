import { BadRequestException, Injectable } from '@nestjs/common'
import {
    PurchaseItemDto,
    ShowtimeDto,
    ShowtimesClient,
    TicketHoldingClient,
    TicketsClient
} from 'apps/cores'
import { PurchaseItemType, TicketStatus } from 'apps/cores'
import { DateUtil } from 'common'
import { uniq } from 'lodash'
import { Rules } from 'shared'
import { CreatePurchaseDto } from '../dtos'
import { PurchaseErrors } from '../errors'
import { PurchaseEvents } from '../purchase.events'

@Injectable()
export class TicketPurchaseService {
    constructor(
        private readonly ticketsClient: TicketsClient,
        private readonly showtimesClient: ShowtimesClient,
        private readonly ticketHoldingClient: TicketHoldingClient,
        private readonly events: PurchaseEvents
    ) {}

    async completePurchase(createDto: CreatePurchaseDto): Promise<void> {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Tickets
        )
        const ticketIds = ticketItems.map((item) => item.itemId)

        await this.ticketsClient.updateStatusMany(ticketIds, TicketStatus.Sold)

        await this.events.emitTicketPurchased(createDto.customerId, ticketIds)
    }

    async rollbackPurchase(createDto: CreatePurchaseDto): Promise<void> {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Tickets
        )
        const ticketIds = ticketItems.map((item) => item.itemId)

        await this.ticketsClient.updateStatusMany(ticketIds, TicketStatus.Available)

        await this.events.emitTicketPurchaseCanceled(createDto.customerId, ticketIds)
    }

    async validatePurchase(createDto: CreatePurchaseDto): Promise<void> {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Tickets
        )
        const showtimes = await this.getShowtimes(ticketItems)

        this.validateTicketCount(ticketItems)
        this.validatePurchaseTime(showtimes)
        await this.validateHeldTickets(createDto.customerId, showtimes, ticketItems)
    }

    private async getShowtimes(ticketItems: PurchaseItemDto[]) {
        const ticketIds = ticketItems.map((item) => item.itemId)
        const tickets = await this.ticketsClient.getMany(ticketIds)
        const showtimeIds = tickets.map((ticket) => ticket.showtimeId)
        const uniqueShowtimeIds = uniq(showtimeIds)
        const showtimes = await this.showtimesClient.getMany(uniqueShowtimeIds)

        return showtimes
    }

    private async validateHeldTickets(
        customerId: string,
        showtimes: ShowtimeDto[],
        ticketItems: PurchaseItemDto[]
    ) {
        const heldTicketIds: string[] = []

        for (const showtime of showtimes) {
            const ticketIds = await this.ticketHoldingClient.searchHeldTicketIds(
                showtime.id,
                customerId
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
        for (const { startTime } of showtimes) {
            const purchaseWindowCloseTime = DateUtil.add({
                base: startTime,
                minutes: -Rules.Ticket.purchaseCutoffMinutes
            })

            if (purchaseWindowCloseTime.getTime() < DateUtil.now().getTime()) {
                throw new BadRequestException(
                    PurchaseErrors.WindowClosed(
                        Rules.Ticket.purchaseCutoffMinutes,
                        purchaseWindowCloseTime.toString(),
                        startTime.toString()
                    )
                )
            }
        }
    }

    private validateTicketCount(ticketItems: PurchaseItemDto[]) {
        if (Rules.Ticket.maxTicketsPerPurchase < ticketItems.length) {
            throw new BadRequestException(
                PurchaseErrors.LimitExceeded(Rules.Ticket.maxTicketsPerPurchase)
            )
        }
    }
}

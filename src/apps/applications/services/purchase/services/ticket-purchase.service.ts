import { BadRequestException, Injectable } from '@nestjs/common'
import {
    PurchaseItemDto,
    PurchaseItemType,
    ShowtimeDto,
    ShowtimesClient,
    TicketHoldingClient,
    TicketsClient,
    TicketStatus
} from 'apps/cores'
import { DateUtil } from 'common'
import { uniq } from 'lodash'
import { Rules } from 'shared'
import { CreatePurchaseDto } from '../dtos'
import { PurchaseEvents } from '../purchase.events'

export const TicketPurchaseErrors = {
    MaxTicketsExceeded: {
        code: 'ERR_PURCHASE_MAX_TICKETS_EXCEEDED',
        message: 'You have exceeded the maximum number of tickets allowed for purchase.'
    },
    WindowClosed: {
        code: 'ERR_TICKET_PURCHASE_WINDOW_CLOSED',
        message: 'Ticket purchase is closed for this showtime.'
    },
    TicketNotHeld: {
        code: 'ERR_PURCHASE_TICKET_NOT_HELD',
        message: 'Only held tickets can be purchased.'
    }
}

@Injectable()
export class TicketPurchaseService {
    constructor(
        private readonly ticketsClient: TicketsClient,
        private readonly showtimesClient: ShowtimesClient,
        private readonly ticketHoldingClient: TicketHoldingClient,
        private readonly events: PurchaseEvents
    ) {}

    async validatePurchase(createDto: CreatePurchaseDto) {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Ticket
        )
        const showtimes = await this.getShowtimes(ticketItems)

        this.validateTicketCount(ticketItems)
        this.validatePurchaseTime(showtimes)
        await this.validateHeldTickets(createDto.customerId, showtimes, ticketItems)

        return true
    }

    private async getShowtimes(ticketItems: PurchaseItemDto[]) {
        const ticketIds = ticketItems.map((item) => item.ticketId)
        const tickets = await this.ticketsClient.getMany(ticketIds)
        const showtimeIds = tickets.map((ticket) => ticket.showtimeId)
        const uniqueShowtimeIds = uniq(showtimeIds)
        const showtimes = await this.showtimesClient.getMany(uniqueShowtimeIds)

        return showtimes
    }

    private validateTicketCount(ticketItems: PurchaseItemDto[]) {
        if (Rules.Ticket.maxTicketsPerPurchase < ticketItems.length) {
            throw new BadRequestException({
                ...TicketPurchaseErrors.MaxTicketsExceeded,
                maxCount: Rules.Ticket.maxTicketsPerPurchase
            })
        }
    }

    private validatePurchaseTime(showtimes: ShowtimeDto[]) {
        for (const { startTime } of showtimes) {
            const purchaseWindowCloseTime = DateUtil.add({
                minutes: -Rules.Ticket.purchaseCutoffMinutes,
                base: startTime
            })

            if (purchaseWindowCloseTime.getTime() < DateUtil.now().getTime()) {
                throw new BadRequestException({
                    ...TicketPurchaseErrors.WindowClosed,
                    purchaseCutoffMinutes: Rules.Ticket.purchaseCutoffMinutes,
                    startTime: startTime.toString(),
                    purchaseWindowCloseTime: purchaseWindowCloseTime.toString()
                })
            }
        }
    }

    private async validateHeldTickets(
        customerId: string,
        showtimes: ShowtimeDto[],
        purchaseItems: PurchaseItemDto[]
    ) {
        const heldTicketIds: string[] = []

        for (const showtime of showtimes) {
            const ticketIds = await this.ticketHoldingClient.searchHeldTicketIds(
                showtime.id,
                customerId
            )
            heldTicketIds.push(...ticketIds)
        }

        const isAllExist = purchaseItems.every((ticket) => heldTicketIds.includes(ticket.ticketId))

        if (!isAllExist) {
            throw new BadRequestException(TicketPurchaseErrors.TicketNotHeld)
        }
    }

    async completePurchase(createDto: CreatePurchaseDto) {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Ticket
        )
        const ticketIds = ticketItems.map((item) => item.ticketId)

        await this.ticketsClient.updateStatusMany(ticketIds, TicketStatus.Sold)

        await this.events.emitTicketPurchased(createDto.customerId, ticketIds)

        return true
    }

    async rollbackPurchase(createDto: CreatePurchaseDto) {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Ticket
        )
        const ticketIds = ticketItems.map((item) => item.ticketId)

        await this.ticketsClient.updateStatusMany(ticketIds, TicketStatus.Available)

        await this.events.emitTicketPurchaseCanceled(createDto.customerId, ticketIds)

        return true
    }
}

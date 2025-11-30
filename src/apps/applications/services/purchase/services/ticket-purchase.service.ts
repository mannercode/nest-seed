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
import { DateUtil, pickItems } from 'common'
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
export class TicketPurchasService {
    constructor(
        private readonly ticketsService: TicketsClient,
        private readonly showtimesService: ShowtimesClient,
        private readonly ticketHoldingService: TicketHoldingClient,
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
        const tickets = await this.ticketsService.getMany(ticketIds)
        const showtimeIds = tickets.map((ticket) => ticket.showtimeId)
        const uniqueShowtimeIds = uniq(showtimeIds)
        const showtimes = await this.showtimesService.getMany(uniqueShowtimeIds)

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
                minutes: -Rules.Ticket.purchaseWindowCloseOffsetMinutes,
                base: startTime
            })

            if (purchaseWindowCloseTime.getTime() < DateUtil.now().getTime()) {
                throw new BadRequestException({
                    ...TicketPurchaseErrors.WindowClosed,
                    purchaseWindowCloseOffsetMinutes: Rules.Ticket.purchaseWindowCloseOffsetMinutes,
                    startTime: startTime.toString(),
                    purchaseWindowCloseTime: purchaseWindowCloseTime.toString()
                })
            }
        }
    }

    private async validateHeldTickets(
        customerId: string,
        showtimes: ShowtimeDto[],
        ticketItems: PurchaseItemDto[]
    ) {
        const heldTicketIds: string[] = []

        for (const showtime of showtimes) {
            const ticketIds = await this.ticketHoldingService.searchHeldTicketIds(
                showtime.id,
                customerId
            )
            heldTicketIds.push(...ticketIds)
        }

        const purchaseTicketIds = pickItems(ticketItems, 'ticketId')

        const isAllExist = purchaseTicketIds.every((ticketId) => heldTicketIds.includes(ticketId))

        if (!isAllExist) {
            throw new BadRequestException(TicketPurchaseErrors.TicketNotHeld)
        }
    }

    async completePurchase(createDto: CreatePurchaseDto) {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Ticket
        )
        const ticketIds = ticketItems.map((item) => item.ticketId)

        await this.ticketsService.updateStatusMany(ticketIds, TicketStatus.Sold)

        await this.events.emitTicketPurchased(createDto.customerId, ticketIds)

        return true
    }

    async rollbackPurchase(createDto: CreatePurchaseDto) {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Ticket
        )
        const ticketIds = ticketItems.map((item) => item.ticketId)

        await this.ticketsService.updateStatusMany(ticketIds, TicketStatus.Available)

        await this.events.emitTicketPurchaseCanceled(createDto.customerId, ticketIds)

        return true
    }
}

import { BadRequestException, Injectable } from '@nestjs/common'
import {
    CreatePurchaseDto,
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
import { PurchaseProcessEvents } from '../purchase-process.events'

export const TicketPurchaseErrors = {
    MaxTicketsExceeded: {
        code: 'ERR_PURCHASE_MAX_TICKETS_EXCEEDED',
        message: 'You have exceeded the maximum number of tickets allowed for purchase.'
    },
    DeadlineExceeded: {
        code: 'ERR_PURCHASE_DEADLINE_EXCEEDED',
        message: 'The purchase deadline has passed.'
    },
    TicketNotHeld: {
        code: 'ERR_PURCHASE_TICKET_NOT_HELD',
        message: 'Only held tickets can be purchased.'
    }
}

// TODO 이름 고민, Service가 붙어야 할 것 같다
@Injectable()
export class TicketPurchaseProcessor {
    constructor(
        private ticketsService: TicketsClient,
        private showtimesService: ShowtimesClient,
        private ticketHoldingService: TicketHoldingClient,
        private events: PurchaseProcessEvents
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
        const tickets = await this.ticketsService.getTickets(ticketIds)
        const showtimeIds = tickets.map((ticket) => ticket.showtimeId)
        const uniqueShowtimeIds = uniq(showtimeIds)
        const showtimes = await this.showtimesService.getShowtimes(uniqueShowtimeIds)

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
            const cutoffTime = DateUtil.addMinutes(
                new Date(),
                Rules.Ticket.purchaseDeadlineInMinutes
            )

            if (startTime.getTime() < cutoffTime.getTime()) {
                throw new BadRequestException({
                    ...TicketPurchaseErrors.DeadlineExceeded,
                    purchaseDeadlineInMinutes: Rules.Ticket.purchaseDeadlineInMinutes,
                    startTime: startTime.toString(),
                    cutoffTime: cutoffTime.toString()
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

        await this.ticketsService.updateTicketStatus(ticketIds, TicketStatus.Sold)

        await this.events.emitTicketPurchased(createDto.customerId, ticketIds)

        return true
    }

    async rollbackPurchase(createDto: CreatePurchaseDto) {
        const ticketItems = createDto.purchaseItems.filter(
            (item) => item.type === PurchaseItemType.Ticket
        )
        const ticketIds = ticketItems.map((item) => item.ticketId)

        await this.ticketsService.updateTicketStatus(ticketIds, TicketStatus.Available)

        await this.events.emitTicketPurchaseCanceled(createDto.customerId, ticketIds)

        return true
    }
}

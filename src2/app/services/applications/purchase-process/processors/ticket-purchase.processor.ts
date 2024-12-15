import { Injectable } from '@nestjs/common'
import { MethodLog, pickItems } from 'common'
import { uniq } from 'lodash'
import {
    PurchaseCreateDto,
    PurchaseItemDto,
    PurchaseItemType,
    ShowtimeDto,
    ShowtimesService,
    TicketHoldingService,
    TicketsService,
    TicketStatus
} from 'services/cores'
import { checkHeldTickets, checkMaxTicketsForPurchase, checkPurchaseDeadline } from '../domain'

@Injectable()
export class TicketPurchaseProcessor {
    constructor(
        private ticketsService: TicketsService,
        private showtimesService: ShowtimesService,
        private ticketHoldingService: TicketHoldingService
    ) {}

    @MethodLog()
    async validatePurchase(createDto: PurchaseCreateDto) {
        const ticketItems = createDto.items.filter((item) => item.type === PurchaseItemType.ticket)
        const showtimes = await this.getShowtimes(ticketItems)

        checkMaxTicketsForPurchase(ticketItems.length)
        await this.validatePurchaseTime(showtimes)
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

    private async validatePurchaseTime(showtimes: ShowtimeDto[]) {
        for (const showtime of showtimes) {
            await checkPurchaseDeadline(showtime.startTime)
        }
    }

    private async validateHeldTickets(
        customerId: string,
        showtimes: ShowtimeDto[],
        ticketItems: PurchaseItemDto[]
    ) {
        const heldTicketIds: string[] = []

        for (const showtime of showtimes) {
            const ticketIds = await this.ticketHoldingService.findHeldTicketIds(
                showtime.id,
                customerId
            )
            heldTicketIds.push(...ticketIds)
        }

        const purchaseTicketIds = pickItems(ticketItems, 'ticketId')

        checkHeldTickets(heldTicketIds, purchaseTicketIds)
    }

    @MethodLog()
    async completePurchase(createDto: PurchaseCreateDto) {
        const ticketItems = createDto.items.filter((item) => item.type === PurchaseItemType.ticket)
        const ticketIds = ticketItems.map((item) => item.ticketId)

        await this.ticketsService.updateTicketStatus(ticketIds, TicketStatus.sold)

        // TicketProcessor ->o]: ticketPurchasedEvent(customer, ticketIds[])
        return true
    }

    @MethodLog()
    /* istanbul ignore next */
    async rollbackPurchase(createDto: PurchaseCreateDto) {
        const ticketItems = createDto.items.filter((item) => item.type === PurchaseItemType.ticket)
        const ticketIds = ticketItems.map((item) => item.ticketId)

        await this.ticketsService.updateTicketStatus(ticketIds, TicketStatus.available)

        // TicketProcessor ->o]: ticketPurchasedEvent(customer, ticketIds[])
        return true
    }
}

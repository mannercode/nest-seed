import { Injectable } from '@nestjs/common'
import { MethodLog, pickItems } from 'common'
import {
    PurchaseCreateDto,
    PurchaseItemDto,
    PurchaseItemType,
    ShowtimeDto,
    ShowtimesProxy,
    TicketHoldingProxy,
    TicketsProxy,
    TicketStatus
} from 'cores'
import { uniq } from 'lodash'
import { checkHeldTickets, checkMaxTicketsForPurchase, checkPurchaseDeadline } from '../domain'
import { PurchaseProcessProxy } from '../purchase-process.proxy'

@Injectable()
export class TicketPurchaseProcessor {
    constructor(
        private ticketsService: TicketsProxy,
        private showtimesService: ShowtimesProxy,
        private ticketHoldingService: TicketHoldingProxy,
        private purchaseProcessProxy: PurchaseProcessProxy
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

        await this.purchaseProcessProxy.emitTicketPurchased(createDto.customerId, ticketIds)

        return true
    }

    @MethodLog()
    async rollbackPurchase(createDto: PurchaseCreateDto) {
        const ticketItems = createDto.items.filter((item) => item.type === PurchaseItemType.ticket)
        const ticketIds = ticketItems.map((item) => item.ticketId)

        await this.ticketsService.updateTicketStatus(ticketIds, TicketStatus.available)

        await this.purchaseProcessProxy.emitTicketPurchaseCanceled(createDto.customerId, ticketIds)

        return true
    }
}

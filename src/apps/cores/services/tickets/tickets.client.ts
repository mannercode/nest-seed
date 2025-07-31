import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import {
    AggregateTicketSalesDto,
    CreateTicketDto,
    CreateTicketsResult,
    SearchTicketsDto,
    TicketDto,
    TicketSalesForShowtimeDto
} from './dtos'
import { TicketStatus } from './models'

@Injectable()
export class TicketsClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    createTickets(createDtos: CreateTicketDto[]): Promise<CreateTicketsResult> {
        return this.proxy.getJson(Messages.Tickets.createTickets, createDtos)
    }

    updateTicketsStatus(ticketIds: string[], status: TicketStatus): Promise<TicketDto[]> {
        return this.proxy.getJson(Messages.Tickets.updateTicketsStatus, { ticketIds, status })
    }

    searchTickets(searchDto: SearchTicketsDto): Promise<TicketDto[]> {
        return this.proxy.getJson(Messages.Tickets.searchTickets, searchDto)
    }

    aggregateTicketSales(
        aggregateDto: AggregateTicketSalesDto
    ): Promise<TicketSalesForShowtimeDto[]> {
        return this.proxy.getJson(Messages.Tickets.aggregateTicketSales, aggregateDto)
    }

    getTickets(ticketIds: string[]): Promise<TicketDto[]> {
        return this.proxy.getJson(Messages.Tickets.getTickets, ticketIds)
    }
}

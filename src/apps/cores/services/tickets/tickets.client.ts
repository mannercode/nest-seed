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

    createMany(createDtos: CreateTicketDto[]): Promise<CreateTicketsResult> {
        return this.proxy.getJson(Messages.Tickets.createMany, createDtos)
    }

    updateStatusMany(ticketIds: string[], status: TicketStatus): Promise<TicketDto[]> {
        return this.proxy.getJson(Messages.Tickets.updateStatusMany, { ticketIds, status })
    }

    search(searchDto: SearchTicketsDto): Promise<TicketDto[]> {
        return this.proxy.getJson(Messages.Tickets.search, searchDto)
    }

    aggregateSales(aggregateDto: AggregateTicketSalesDto): Promise<TicketSalesForShowtimeDto[]> {
        return this.proxy.getJson(Messages.Tickets.aggregateSales, aggregateDto)
    }

    getMany(ticketIds: string[]): Promise<TicketDto[]> {
        return this.proxy.getJson(Messages.Tickets.getMany, ticketIds)
    }
}

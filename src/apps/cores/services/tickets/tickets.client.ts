import { Injectable } from '@nestjs/common'
import { ClientProxyService } from 'common'
import { InjectClientProxy } from 'common'
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
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    deleteBySagaIds(sagaIds: string[]): Promise<void> {
        return this.proxy.request(Messages.Tickets.deleteBySagaIds, sagaIds)
    }

    aggregateSales(aggregateDto: AggregateTicketSalesDto): Promise<TicketSalesForShowtimeDto[]> {
        return this.proxy.request(Messages.Tickets.aggregateSales, aggregateDto)
    }

    createMany(createDtos: CreateTicketDto[]): Promise<CreateTicketsResult> {
        return this.proxy.request(Messages.Tickets.createMany, createDtos)
    }

    getMany(ticketIds: string[]): Promise<TicketDto[]> {
        return this.proxy.request(Messages.Tickets.getMany, ticketIds)
    }

    search(searchDto: SearchTicketsDto): Promise<TicketDto[]> {
        return this.proxy.request(Messages.Tickets.search, searchDto)
    }

    updateStatusMany(ticketIds: string[], status: TicketStatus): Promise<TicketDto[]> {
        return this.proxy.request(Messages.Tickets.updateStatusMany, { status, ticketIds })
    }
}

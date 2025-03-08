import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { SalesStatusByShowtimeDto, TicketCreateDto, TicketDto, TicketFilterDto } from './dtos'
import { TicketStatus } from './models'

@Injectable()
export class TicketsProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    createTickets(createDtos: TicketCreateDto[]): Promise<{ success: boolean; count: number }> {
        return this.service.getJson(Messages.Tickets.createTickets, createDtos)
    }

    updateTicketStatus(ticketIds: string[], status: TicketStatus): Promise<TicketDto[]> {
        return this.service.getJson(Messages.Tickets.updateTicketStatus, { ticketIds, status })
    }

    findAllTickets(filterDto: TicketFilterDto): Promise<TicketDto[]> {
        return this.service.getJson(Messages.Tickets.findAllTickets, filterDto)
    }

    getSalesStatuses(ticketIds: string[]): Promise<SalesStatusByShowtimeDto[]> {
        return this.service.getJson(Messages.Tickets.getSalesStatuses, ticketIds)
    }

    getTickets(ticketIds: string[]): Promise<TicketDto[]> {
        return this.service.getJson(Messages.Tickets.getTickets, ticketIds)
    }
}

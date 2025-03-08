import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { SalesStatusByShowtimeDto, TicketCreateDto, TicketDto, TicketFilterDto } from './dtos'
import { TicketStatus } from './models'

@Injectable()
export class TicketsProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    createTickets(createDtos: TicketCreateDto[]): Promise<{ success: boolean; count: number }> {
        return this.service.getJson(Messages.Tickets.createTickets, createDtos)
    }

    @MethodLog({ level: 'verbose' })
    updateTicketStatus(ticketIds: string[], status: TicketStatus): Promise<TicketDto[]> {
        return this.service.getJson(Messages.Tickets.updateTicketStatus, { ticketIds, status })
    }

    @MethodLog({ level: 'verbose' })
    findAllTickets(filterDto: TicketFilterDto): Promise<TicketDto[]> {
        return this.service.getJson(Messages.Tickets.findAllTickets, filterDto)
    }

    @MethodLog({ level: 'verbose' })
    getSalesStatuses(ticketIds: string[]): Promise<SalesStatusByShowtimeDto[]> {
        return this.service.getJson(Messages.Tickets.getSalesStatuses, ticketIds)
    }

    @MethodLog({ level: 'verbose' })
    getTickets(ticketIds: string[]): Promise<TicketDto[]> {
        return this.service.getJson(Messages.Tickets.getTickets, ticketIds)
    }
}

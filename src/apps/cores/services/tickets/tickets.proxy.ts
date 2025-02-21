import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Subjects } from 'shared/config'
import { SalesStatusByShowtimeDto, TicketCreateDto, TicketDto, TicketFilterDto } from './dtos'
import { TicketStatus } from './models'

@Injectable()
export class TicketsProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    createTickets(createDtos: TicketCreateDto[]): Promise<{ success: boolean; count: number }> {
        return getProxyValue(this.service.send(Subjects.Tickets.createTickets, createDtos))
    }

    @MethodLog({ level: 'verbose' })
    updateTicketStatus(ticketIds: string[], status: TicketStatus): Promise<TicketDto[]> {
        return getProxyValue(
            this.service.send(Subjects.Tickets.updateTicketStatus, { ticketIds, status })
        )
    }

    @MethodLog({ level: 'verbose' })
    findAllTickets(filterDto: TicketFilterDto): Promise<TicketDto[]> {
        return getProxyValue(this.service.send(Subjects.Tickets.findAllTickets, filterDto))
    }

    @MethodLog({ level: 'verbose' })
    getSalesStatuses(ticketIds: string[]): Promise<SalesStatusByShowtimeDto[]> {
        return getProxyValue(this.service.send(Subjects.Tickets.getSalesStatuses, ticketIds))
    }

    @MethodLog({ level: 'verbose' })
    getTickets(ticketIds: string[]): Promise<TicketDto[]> {
        return getProxyValue(this.service.send(Subjects.Tickets.getTickets, ticketIds))
    }
}

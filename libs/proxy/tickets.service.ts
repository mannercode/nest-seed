import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, MethodLog } from 'common'
import {
    SalesStatusByShowtimeDto,
    TicketCreateDto,
    TicketDto,
    TicketFilterDto,
    TicketStatus
} from 'types'

@Injectable()
export class TicketsService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createTickets(createDtos: TicketCreateDto[]): Promise<{ success: boolean; count: number }> {
        return getProxyValue(this.service.send('createTickets', createDtos))
    }

    @MethodLog({ level: 'verbose' })
    updateTicketStatus(ticketIds: string[], status: TicketStatus): Promise<TicketDto[]> {
        return getProxyValue(this.service.send('updateTicketStatus', { ticketIds, status }))
    }

    @MethodLog({ level: 'verbose' })
    findAllTickets(filterDto: TicketFilterDto): Promise<TicketDto[]> {
        return getProxyValue(this.service.send('findAllTickets', filterDto))
    }

    @MethodLog({ level: 'verbose' })
    getSalesStatuses(ticketIds: string[]): Promise<SalesStatusByShowtimeDto[]> {
        return getProxyValue(this.service.send('getSalesStatuses', ticketIds))
    }

    @MethodLog({ level: 'verbose' })
    getTickets(ticketIds: string[]): Promise<TicketDto[]> {
        return getProxyValue(this.service.send('getTickets', ticketIds))
    }
}

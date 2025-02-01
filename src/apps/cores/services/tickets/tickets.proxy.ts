import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { SalesStatusByShowtimeDto, TicketCreateDto, TicketDto, TicketFilterDto } from './dtos'
import { TicketStatus } from './models'

@Injectable()
export class TicketsProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createTickets(createDtos: TicketCreateDto[]): Promise<{ success: boolean; count: number }> {
        return getProxyValue(this.service.send('cores.tickets.createTickets', createDtos))
    }

    @MethodLog({ level: 'verbose' })
    updateTicketStatus(ticketIds: string[], status: TicketStatus): Promise<TicketDto[]> {
        return getProxyValue(this.service.send('cores.tickets.updateTicketStatus', { ticketIds, status }))
    }

    @MethodLog({ level: 'verbose' })
    findAllTickets(filterDto: TicketFilterDto): Promise<TicketDto[]> {
        return getProxyValue(this.service.send('cores.tickets.findAllTickets', filterDto))
    }

    @MethodLog({ level: 'verbose' })
    getSalesStatuses(ticketIds: string[]): Promise<SalesStatusByShowtimeDto[]> {
        return getProxyValue(this.service.send('cores.tickets.getSalesStatuses', ticketIds))
    }

    @MethodLog({ level: 'verbose' })
    getTickets(ticketIds: string[]): Promise<TicketDto[]> {
        return getProxyValue(this.service.send('cores.tickets.getTickets', ticketIds))
    }
}

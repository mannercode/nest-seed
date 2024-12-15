import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog } from 'common'
import { Observable } from 'rxjs'
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
    createTickets(createDtos: TicketCreateDto[]): Observable<{ success: boolean; count: number }> {
        return this.service.send('createTickets', createDtos)
    }

    @MethodLog({ level: 'verbose' })
    updateTicketStatus(ticketIds: string[], status: TicketStatus): Observable<TicketDto[]> {
        return this.service.send('updateTicketStatus', { ticketIds, status })
    }

    @MethodLog({ level: 'verbose' })
    findAllTickets(filterDto: TicketFilterDto): Observable<TicketDto[]> {
        return this.service.send('findAllTickets', filterDto)
    }

    @MethodLog({ level: 'verbose' })
    getSalesStatuses(ticketIds: string[]): Observable<SalesStatusByShowtimeDto[]> {
        return this.service.send('getSalesStatuses', ticketIds)
    }

    @MethodLog({ level: 'verbose' })
    getTickets(ticketIds: string[]): Observable<TicketDto[]> {
        return this.service.send('getTickets', ticketIds)
    }
}

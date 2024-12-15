import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import {
    SalesStatusByShowtimeDto,
    TicketCreateDto,
    TicketDto,
    TicketFilterDto,
    TicketStatus
} from 'types'

@Injectable()
export class TicketsService {
    constructor() {}

    @MethodLog()
    async createTickets(
        createDtos: TicketCreateDto[]
    ): Promise<{ success: boolean; count: number }> {
        return { success: true, count: 0 }
    }

    @MethodLog()
    async updateTicketStatus(ticketIds: string[], status: TicketStatus): Promise<TicketDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async findAllTickets(filterDto: TicketFilterDto): Promise<TicketDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async getSalesStatuses(ticketIds: string[]): Promise<SalesStatusByShowtimeDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async getTickets(ticketIds: string[]): Promise<TicketDto[]> {
        return []
    }
}

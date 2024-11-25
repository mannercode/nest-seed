import { Injectable } from '@nestjs/common'
import { Assert, MethodLog, toDtos } from 'common'
import { TicketCreateDto, TicketDto } from './dtos'
import { TicketFilterDto } from './dtos/ticket-filter.dto'
import { TicketStatus } from './models'
import { TicketsRepository } from './tickets.repository'

@Injectable()
export class TicketsService {
    constructor(private repository: TicketsRepository) {}

    @MethodLog()
    async createTickets(createDtos: TicketCreateDto[]) {
        await this.repository.createTickets(createDtos)

        return { success: true, count: createDtos.length }
    }

    @MethodLog()
    async updateTicketStatus(ticketIds: string[], status: TicketStatus): Promise<TicketDto[]> {
        const result = await this.repository.updateTicketStatus(ticketIds, status)

        Assert.equals(
            result.matchedCount,
            result.modifiedCount,
            'The status of all tickets must be changed.'
        )

        const tickets = await this.repository.getByIds(ticketIds)

        return toDtos(tickets, TicketDto)
    }

    @MethodLog({ level: 'verbose' })
    async findAllTickets(filterDto: TicketFilterDto) {
        const tickets = await this.repository.findAllTickets(filterDto)

        return toDtos(tickets, TicketDto)
    }

    @MethodLog({ level: 'verbose' })
    async getSalesStatuses(showtimeIds: string[]) {
        const statuses = await this.repository.getSalesStatuses(showtimeIds)
        return statuses
    }
}

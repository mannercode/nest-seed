import { Injectable } from '@nestjs/common'
import { Assert, maps, MethodLog } from 'common'
import { TicketCreationDto, TicketDto } from './dto'
import { TicketFilterDto } from './dto/ticket-filter.dto'
import { TicketStatus } from './schemas'
import { TicketsRepository } from './tickets.repository'

@Injectable()
export class TicketsService {
    constructor(private repository: TicketsRepository) {}

    @MethodLog()
    async createTickets(creationDtos: TicketCreationDto[]) {
        await this.repository.createTickets(creationDtos)

        return { success: true, count: creationDtos.length }
    }

    @MethodLog()
    async updateTicketStatus(ticketIds: string[], status: TicketStatus): Promise<TicketDto[]> {
        const result = await this.repository.updateTicketStatus(ticketIds, status)

        Assert.equals(
            result.matchedCount,
            result.modifiedCount,
            'The status of all tickets must be changed.'
        )

        const tickets = await this.repository.findByIds(ticketIds)
        return maps(tickets, TicketDto)
    }

    @MethodLog({ level: 'verbose' })
    async findAllTickets(filterDto: TicketFilterDto) {
        const tickets = await this.repository.findAllTickets(filterDto)
        return maps(tickets, TicketDto)
    }

    @MethodLog({ level: 'verbose' })
    async getSalesStatuses(showtimeIds: string[]) {
        const statuses = await this.repository.getSalesStatuses(showtimeIds)
        return statuses
    }
}

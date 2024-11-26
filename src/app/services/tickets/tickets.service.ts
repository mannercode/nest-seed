import { Injectable } from '@nestjs/common'
import { Assert, MethodLog } from 'common'
import { TicketCreateDto, TicketFilterDto } from './dtos'
import { TicketDocument, TicketDto, TicketStatus } from './models'
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

        return this.toDtos(tickets)
    }

    @MethodLog({ level: 'verbose' })
    async findAllTickets(filterDto: TicketFilterDto) {
        const tickets = await this.repository.findAllTickets(filterDto)

        return this.toDtos(tickets)
    }

    @MethodLog({ level: 'verbose' })
    async getSalesStatuses(ticketIds: string[]) {
        const statuses = await this.repository.getSalesStatuses(ticketIds)
        return statuses
    }

    private toDto = (ticket: TicketDocument) => ticket.toJSON<TicketDto>()
    private toDtos = (tickets: TicketDocument[]) => tickets.map((ticket) => this.toDto(ticket))
}

import { Injectable } from '@nestjs/common'
import { Assert, maps, MethodLog, objectId, ObjectId } from 'common'
import { TicketCreateDto, TicketDto } from './dtos'
import { TicketFilterDto } from './dtos/ticket-filter.dto'
import { TicketStatus } from './models'
import { TicketsRepository } from './tickets.repository'

@Injectable()
export class TicketsService {
    constructor(private repository: TicketsRepository) {}

    @MethodLog()
    async createTickets(createDtos: TicketCreateDto[]) {
        const ticketsToCreate = createDtos.map((dto) => ({
            ...dto,
            batchId: objectId(dto.batchId),
            theaterId: objectId(dto.theaterId),
            movieId: objectId(dto.movieId),
            showtimeId: objectId(dto.showtimeId)
        }))

        await this.repository.createTickets(ticketsToCreate)

        return { success: true, count: ticketsToCreate.length }
    }

    @MethodLog()
    async updateTicketStatus(ticketIds: ObjectId[], status: TicketStatus): Promise<TicketDto[]> {
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

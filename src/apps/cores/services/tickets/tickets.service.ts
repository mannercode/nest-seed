import { Injectable } from '@nestjs/common'
import { Expect, mapDocToDto } from 'common'
import type {
    AggregateTicketSalesDto,
    CreateTicketDto,
    CreateTicketsResult,
    SearchTicketsDto
} from './dtos'
import type { Ticket, TicketStatus } from './models'
import type { TicketsRepository } from './tickets.repository'
import { TicketDto } from './dtos'

@Injectable()
export class TicketsService {
    constructor(private readonly repository: TicketsRepository) {}

    async aggregateSales(aggregateDto: AggregateTicketSalesDto) {
        const salesByShowtime = await this.repository.aggregateSales(aggregateDto)
        return salesByShowtime
    }

    async createMany(createDtos: CreateTicketDto[]) {
        await this.repository.createMany(createDtos)

        return { count: createDtos.length, success: true } as CreateTicketsResult
    }

    async getMany(ticketIds: string[]) {
        const tickets = await this.repository.getByIds(ticketIds)

        return this.toDtos(tickets)
    }

    async search(searchDto: SearchTicketsDto) {
        const tickets = await this.repository.search(searchDto)

        return this.toDtos(tickets)
    }

    async updateStatusMany(ticketIds: string[], status: TicketStatus) {
        const result = await this.repository.updateStatusMany(ticketIds, status)

        Expect.equals(
            result.matchedCount,
            result.modifiedCount,
            'The status of all tickets must be changed.'
        )

        const tickets = await this.repository.getByIds(ticketIds)

        return this.toDtos(tickets)
    }

    private toDtos(tickets: Ticket[]) {
        return tickets.map((ticket) =>
            mapDocToDto(ticket, TicketDto, [
                'id',
                'showtimeId',
                'theaterId',
                'movieId',
                'status',
                'seat'
            ])
        )
    }
}

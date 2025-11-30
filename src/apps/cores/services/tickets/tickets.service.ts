import { Injectable } from '@nestjs/common'
import { Assert, mapDocToDto } from 'common'
import {
    AggregateTicketSalesDto,
    CreateTicketDto,
    CreateTicketsResult,
    SearchTicketsDto,
    TicketDto
} from './dtos'
import { TicketDocument, TicketStatus } from './models'
import { TicketsRepository } from './tickets.repository'

@Injectable()
export class TicketsService {
    constructor(private readonly repository: TicketsRepository) {}

    async createMany(createDtos: CreateTicketDto[]) {
        await this.repository.createMany(createDtos)

        return { success: true, count: createDtos.length } as CreateTicketsResult
    }

    async updateStatusMany(ticketIds: string[], status: TicketStatus) {
        const result = await this.repository.updateStatusMany(ticketIds, status)

        Assert.equals(
            result.matchedCount,
            result.modifiedCount,
            'The status of all tickets must be changed.'
        )

        const tickets = await this.repository.getByIds(ticketIds)

        return this.toDtos(tickets)
    }

    async search(searchDto: SearchTicketsDto) {
        const tickets = await this.repository.search(searchDto)

        return this.toDtos(tickets)
    }

    async aggregateSales(aggregateDto: AggregateTicketSalesDto) {
        const statuses = await this.repository.aggregateSales(aggregateDto)
        return statuses
    }

    async getMany(ticketIds: string[]) {
        const tickets = await this.repository.getByIds(ticketIds)

        return this.toDtos(tickets)
    }

    private toDto = (ticket: TicketDocument) =>
        mapDocToDto(ticket, TicketDto, [
            'id',
            'showtimeId',
            'theaterId',
            'movieId',
            'status',
            'seat'
        ])

    private toDtos = (tickets: TicketDocument[]) => tickets.map((ticket) => this.toDto(ticket))
}

import { mapDocToDto, Require } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import {
    AggregateTicketSalesDto,
    CreateTicketDto,
    CreateTicketsResult,
    SearchTicketsDto,
    TicketDto
} from './dtos'
import { Ticket, TicketStatus } from './models'
import { TicketsRepository } from './tickets.repository'

@Injectable()
export class TicketsService {
    constructor(private readonly repository: TicketsRepository) {}

    async deleteBySagaIds(sagaIds: string[]) {
        await this.repository.deleteBySagaIds(sagaIds)
    }

    async aggregateSales(aggregateDto: AggregateTicketSalesDto) {
        const salesByShowtime = await this.repository.aggregateSales(aggregateDto)
        return salesByShowtime
    }

    async createMany(createDtos: CreateTicketDto[]): Promise<CreateTicketsResult> {
        await this.repository.createMany(createDtos)

        return { count: createDtos.length }
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

        // matched < input → 존재하지 않는 ticketId 가 섞여 있다 (caller 잘못).
        Require.equals(
            result.matchedCount,
            ticketIds.length,
            'All ticket IDs must match existing documents.'
        )
        // matched > modified → 일부 티켓이 이미 같은 상태였음 (멱등성 가정 위배).
        Require.equals(
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

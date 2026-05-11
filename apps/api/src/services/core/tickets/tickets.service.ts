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

        // 매칭된 문서 수가 입력 개수보다 적으면, 호출자가 없는 ticketId 를
        // 넘긴 것이다.
        Require.equals(
            result.matchedCount,
            ticketIds.length,
            'All ticket IDs must match existing documents.'
        )
        // 매칭은 됐지만 수정이 안 된 문서가 있으면, 일부 티켓이 이미 같은
        // 상태였다는 뜻이다. 멱등 호출이 아니라 잘못된 상태 전이라서 막는다.
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

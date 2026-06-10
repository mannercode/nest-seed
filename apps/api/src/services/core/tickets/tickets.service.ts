import { mapDocToDto } from '@mannercode/common'
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

    async transitStatusMany(ticketIds: string[], from: TicketStatus, to: TicketStatus) {
        // 누락된 ticketId는 `getByIds`가 404로 분리한다.
        // 상태 충돌(409)과 전이는 리포지토리가 한 트랜잭션에서 원자적으로 판정한다.
        await this.repository.getByIds(ticketIds)

        await this.repository.transitStatusMany(ticketIds, from, to)

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

import { mapDocToDto } from '@mannercode/common'
import { ConflictException, Injectable } from '@nestjs/common'
import {
    AggregateTicketSalesDto,
    CreateTicketDto,
    CreateTicketsResult,
    SearchTicketsDto,
    TicketDto
} from './dtos'
import { TicketErrors } from './errors'
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
        // 사전 검사로 두 가지 충돌을 분리한다.
        // 1) 누락된 ticketId — `getByIds`가 404로 던진다.
        // 2) 이미 목표 상태인 티켓 — 도메인 충돌이므로 409로 거절한다.
        // Mongoose 버전에 따라 `updateMany`의 `modifiedCount`가 같은 값으로 set한 도큐먼트를 다르게 계산해 결과만으로는 판정이 흔들린다.
        const existing = await this.repository.getByIds(ticketIds)
        const alreadyAtTarget = existing
            .filter((ticket) => ticket.status === status)
            .map((ticket) => ticket.id)
        if (alreadyAtTarget.length > 0) {
            throw new ConflictException(TicketErrors.StatusTransitionFailed(alreadyAtTarget))
        }

        await this.repository.updateStatusMany(ticketIds, status)

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

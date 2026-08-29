import type { ClientSession } from 'mongodb'
import { mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import {
    AggregateTicketSalesDto,
    CreateTicketDto,
    CreateTicketsResult,
    SearchTicketsDto,
    TicketDto
} from './dtos/index.js'
import { Ticket, TicketStatus } from './models/index.js'
import { TicketsRepository } from './tickets.repository.js'

@Injectable()
export class TicketsService {
    constructor(private readonly repository: TicketsRepository) {}

    async aggregateSales(aggregateDto: AggregateTicketSalesDto) {
        const salesByShowtime = await this.repository.aggregateSales(aggregateDto)
        return salesByShowtime
    }

    async createMany(
        createDtos: CreateTicketDto[],
        session: ClientSession | undefined = undefined,
        signal: AbortSignal | undefined = undefined
    ): Promise<CreateTicketsResult> {
        await this.repository.createMany(createDtos, session, signal)

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

    async transitStatusMany(
        ticketIds: string[],
        from: TicketStatus,
        to: TicketStatus,
        purchaseRecordId?: string,
        session?: ClientSession
    ) {
        // 누락된 ticketId는 `getByIds`가 404로 분리한다.
        // 상태 충돌(409)과 전이는 리포지토리가 한 트랜잭션에서 원자적으로 판정한다.
        await this.repository.getByIds(ticketIds, session)

        await this.repository.transitStatusMany(ticketIds, from, to, purchaseRecordId, session)

        const tickets = await this.repository.getByIds(ticketIds, session)

        return this.toDtos(tickets)
    }

    async releasePurchase(ticketIds: string[], purchaseRecordId: string) {
        const releaseIds = await this.repository.getPurchaseReleaseIds(ticketIds, purchaseRecordId)
        if (releaseIds.length === 0) return this.getMany(ticketIds)

        await this.transitStatusMany(
            releaseIds,
            TicketStatus.Sold,
            TicketStatus.Available,
            purchaseRecordId
        )
        return this.getMany(ticketIds)
    }

    async releaseOwnedPurchaseForCompensation(ticketIds: string[], purchaseRecordId: string) {
        await this.repository.releaseOwnedPurchaseForCompensation(ticketIds, purchaseRecordId)
    }

    async sellForPurchase(
        ticketIds: string[],
        purchaseRecordId: string,
        session: ClientSession | undefined = undefined
    ) {
        return this.transitStatusMany(
            ticketIds,
            TicketStatus.Available,
            TicketStatus.Sold,
            purchaseRecordId,
            session
        )
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

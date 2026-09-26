import { type TransactionContext, ensure, mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import {
    AggregateTicketSalesDto,
    CreateTicketDto,
    CreateTicketsResult,
    SearchTicketsDto,
    TicketSchema
} from './dtos/index.js'
import { Ticket } from './models/index.js'
import { TicketsRepository } from './tickets.repository.js'

@Injectable()
export class TicketsService {
    constructor(private readonly repository: TicketsRepository) {}

    async aggregateSales(aggregateDto: AggregateTicketSalesDto) {
        const ticketSales = await this.repository.aggregateSales(aggregateDto)
        const salesByShowtime = new Map(ticketSales.map((sales) => [sales.showtimeId, sales]))

        return ensure(aggregateDto.showtimeIds).map(
            (showtimeId) =>
                salesByShowtime.get(showtimeId) ?? { available: 0, showtimeId, sold: 0, total: 0 }
        )
    }

    async createMany(
        createDtos: CreateTicketDto[],
        transaction: TransactionContext | undefined = undefined,
        signal: AbortSignal | undefined = undefined
    ): Promise<CreateTicketsResult> {
        await this.repository.createMany(createDtos, transaction, signal)

        return { count: createDtos.length }
    }

    async getMany(ticketIds: string[]) {
        const tickets = await this.repository.getMany({ ids: ticketIds })

        return this.toDtos(tickets)
    }

    async search(searchDto: SearchTicketsDto) {
        const tickets = await this.repository.search(searchDto)

        return this.toDtos(tickets)
    }

    async sellForPurchase(
        ticketIds: string[],
        purchaseRecordId: string,
        transaction: TransactionContext | undefined = undefined
    ) {
        // 누락된 ticketId는 `getMany`가 404로 분리한다.
        // 판매 충돌(409)은 리포지토리가 한 트랜잭션에서 원자적으로 판정한다.
        await this.repository.getMany({ ids: ticketIds, transaction })

        await this.repository.sellAvailableForPurchase(ticketIds, purchaseRecordId, transaction)

        const tickets = await this.repository.getMany({ ids: ticketIds, transaction })

        return this.toDtos(tickets)
    }

    private toDtos(tickets: Ticket[]) {
        return tickets.map((ticket) => mapDocToDto(ticket, TicketSchema))
    }
}

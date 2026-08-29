import type { ClientSession } from 'mongodb'
import {
    QueryBuilderOptions,
    CrudRepository,
    objectIds,
    QueryBuilder,
    mongoArrayToPublic
} from '@mannercode/common'
import { ConflictException, Injectable } from '@nestjs/common'
import { AppConfigService, MongoConnection } from '#config'
import {
    AggregateTicketSalesDto,
    CreateTicketDto,
    SearchTicketsDto,
    TicketSalesForShowtimeDto
} from './dtos/index.js'
import { TicketErrors } from './errors.js'
import { Ticket, TicketStatus } from './models/index.js'

@Injectable()
export class TicketsRepository extends CrudRepository<Ticket> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection.db.collection('tickets'),
            connection.client,
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize,
            { indexes: [{ key: { deletedAt: 1, showtimeId: 1 } }, { key: { sagaId: 1 } }] }
        )
    }

    async aggregateSales(aggregateDto: AggregateTicketSalesDto) {
        const query = this.buildQuery(aggregateDto)

        const showtimeTicketSalesArray = await this.collection
            .aggregate<TicketSalesForShowtimeDto>([
                { $match: this.activeFilter(query) },
                {
                    $group: {
                        _id: '$showtimeId',
                        sold: { $sum: { $cond: [{ $eq: ['$status', TicketStatus.Sold] }, 1, 0] } },
                        total: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        available: { $subtract: ['$total', '$sold'] },
                        showtimeId: { $toString: '$_id' },
                        sold: 1,
                        total: 1
                    }
                }
            ])
            .toArray()

        return showtimeTicketSalesArray
    }

    async createMany(
        createDtos: CreateTicketDto[],
        session: ClientSession | undefined = undefined,
        signal: AbortSignal | undefined = undefined
    ) {
        const tickets = createDtos.map((dto) => {
            const ticket = this.newDocument()
            ticket.sagaId = dto.sagaId
            ticket.movieId = dto.movieId
            ticket.theaterId = dto.theaterId
            ticket.showtimeId = dto.showtimeId
            ticket.status = dto.status
            ticket.seat = dto.seat
            ticket.purchaseRecordId = null

            return ticket
        })

        await this.insertMany(tickets, session, signal)
    }

    async search(searchDto: SearchTicketsDto) {
        const query = this.buildQuery(searchDto)

        const tickets = await this.collection
            .find(this.activeFilter(query))
            .sort({ sagaId: 1 })
            .toArray()
        return mongoArrayToPublic<Ticket>(tickets)
    }

    async transitStatusMany(
        ticketIds: string[],
        from: TicketStatus,
        to: TicketStatus,
        purchaseRecordId?: string,
        session?: ClientSession
    ) {
        // 검사와 쓰기 사이에 다른 결제가 끼어드는 경쟁을 트랜잭션 + 상태 조건으로 차단한다.
        // 하나라도 `from` 상태가 아니면 전체를 중단해, 겹치는 티켓 묶음의 동시 결제에서도 같은 티켓이 두 번 팔리지 않는다.
        const ids = objectIds(ticketIds)

        const transition = async (activeSession: ClientSession) => {
            const ownershipFilter = purchaseRecordId
                ? from === TicketStatus.Available
                    ? { purchaseRecordId: null }
                    : { purchaseRecordId }
                : {}
            const filter = { _id: { $in: ids }, status: from, ...ownershipFilter }
            const update =
                to === TicketStatus.Sold && purchaseRecordId
                    ? { $set: { purchaseRecordId, status: to } }
                    : to === TicketStatus.Available
                      ? { $set: { status: to }, $unset: { purchaseRecordId: 1 } }
                      : { $set: { status: to } }

            const activeFilter = this.activeFilter(filter)
            const result = await this.collection.updateMany(
                activeFilter,
                this.timestamped(update),
                { session: activeSession }
            )

            if (result.matchedCount !== ticketIds.length) {
                // 세션 없는 조회는 커밋 전 상태를 보므로, 전이할 수 없었던 티켓이 그대로 드러난다.
                const eligibleDocs = await this.collection
                    .find(activeFilter, { projection: { _id: 1 } })
                    .toArray()
                const eligibleIds = new Set(eligibleDocs.map((doc) => String(doc._id)))
                const failedIds = ticketIds.filter((ticketId) => !eligibleIds.has(ticketId))
                throw new ConflictException(TicketErrors.StatusTransitionFailed(failedIds))
            }
        }

        if (session) {
            await transition(session)
            return
        }
        await this.withTransaction(transition)
    }

    async getPurchaseReleaseIds(ticketIds: string[], purchaseRecordId: string) {
        const ids = objectIds(ticketIds)
        const tickets = await this.collection
            .find(this.activeFilter({ _id: { $in: ids } }), {
                projection: { _id: 1, purchaseRecordId: 1, status: 1 }
            })
            .toArray()

        const foundIds = new Set(tickets.map((ticket) => String(ticket._id)))
        const missingIds = ticketIds.filter((ticketId) => !foundIds.has(ticketId))
        if (missingIds.length > 0) {
            await this.getByIds(ticketIds)
        }

        const conflictingIds = tickets
            .filter(
                (ticket) =>
                    ticket.status !== TicketStatus.Available &&
                    ticket.purchaseRecordId !== purchaseRecordId
            )
            .map((ticket) => String(ticket._id))

        if (conflictingIds.length > 0) {
            throw new ConflictException(TicketErrors.StatusTransitionFailed(conflictingIds))
        }

        return tickets
            .filter(
                (ticket) =>
                    ticket.status === TicketStatus.Sold &&
                    ticket.purchaseRecordId === purchaseRecordId
            )
            .map((ticket) => String(ticket._id))
    }

    async releaseOwnedPurchaseForCompensation(ticketIds: string[], purchaseRecordId: string) {
        // 보상 재시도 시점에는 이전 owner가 이미 풀어 준 티켓이 새 구매에
        // 팔렸을 수 있다. 오직 이 구매가 아직 소유한 Sold만 풀고 나머지는 no-op한다.
        await this.collection.updateMany(
            this.activeFilter({
                _id: { $in: objectIds(ticketIds) },
                purchaseRecordId,
                status: TicketStatus.Sold
            }),
            this.timestamped({
                $set: { status: TicketStatus.Available },
                $unset: { purchaseRecordId: 1 }
            })
        )
    }

    private buildQuery(searchDto: SearchTicketsDto, options: QueryBuilderOptions = {}) {
        const { movieIds, sagaIds, showtimeIds, theaterIds } = searchDto

        const builder = new QueryBuilder<Ticket>()
        builder.addIn('sagaId', sagaIds)
        builder.addIn('movieId', movieIds)
        builder.addIn('theaterId', theaterIds)
        builder.addIn('showtimeId', showtimeIds)

        const query = builder.build(options)
        return query
    }
}

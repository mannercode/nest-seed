import {
    QueryBuilderOptions,
    CrudRepository,
    objectIds,
    QueryBuilder,
    leanArrayToPublic
} from '@mannercode/common'
import { ConflictException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { Model } from 'mongoose'
import {
    AggregateTicketSalesDto,
    CreateTicketDto,
    SearchTicketsDto,
    TicketSalesForShowtimeDto
} from './dtos'
import { TicketErrors } from './errors'
import { Ticket, TicketStatus } from './models'

@Injectable()
export class TicketsRepository extends CrudRepository<Ticket> {
    constructor(
        @InjectModel(Ticket.name, MONGO_CONNECTION_NAME) readonly model: Model<Ticket>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize)
    }

    async deleteBySagaIds(sagaIds: string[]) {
        await this.model.deleteMany({ sagaId: { $in: sagaIds } })
    }

    async aggregateSales(aggregateDto: AggregateTicketSalesDto) {
        const query = this.buildQuery(aggregateDto)

        const showtimeTicketSalesArray = await this.model.aggregate<TicketSalesForShowtimeDto>([
            { $match: query },
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

        return showtimeTicketSalesArray
    }

    async createMany(createDtos: CreateTicketDto[]) {
        const tickets = createDtos.map((dto) => {
            const ticket = this.newDocument()
            ticket.sagaId = dto.sagaId
            ticket.movieId = dto.movieId
            ticket.theaterId = dto.theaterId
            ticket.showtimeId = dto.showtimeId
            ticket.status = dto.status
            ticket.seat = dto.seat

            return ticket
        })

        await this.saveMany(tickets)
    }

    async search(searchDto: SearchTicketsDto) {
        const query = this.buildQuery(searchDto)

        const tickets = await this.model.find(query).sort({ sagaId: 1 }).lean().exec()
        return leanArrayToPublic<Ticket>(tickets)
    }

    async transitStatusMany(ticketIds: string[], from: TicketStatus, to: TicketStatus) {
        // 검사와 쓰기 사이에 다른 결제가 끼어드는 경쟁을 트랜잭션 + 상태 조건으로 차단한다.
        // 하나라도 `from` 상태가 아니면 전체를 중단해, 겹치는 티켓 묶음의 동시 결제에서도 같은 티켓이 두 번 팔리지 않는다.
        const ids = objectIds(ticketIds)

        await this.withTransaction(async (session) => {
            const result = await this.model.updateMany(
                { _id: { $in: ids }, status: from },
                { $set: { status: to } },
                { session }
            )

            if (result.matchedCount !== ticketIds.length) {
                // 세션 없는 조회는 커밋 전 상태를 보므로, 전이할 수 없었던 티켓이 그대로 드러난다.
                const eligibleDocs = await this.model
                    .find({ _id: { $in: ids }, status: from }, { _id: 1 })
                    .lean()
                const eligibleIds = new Set(eligibleDocs.map((doc) => String(doc._id)))
                const failedIds = ticketIds.filter((ticketId) => !eligibleIds.has(ticketId))
                throw new ConflictException(TicketErrors.StatusTransitionFailed(failedIds))
            }
        })
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

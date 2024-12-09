import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
    addInQuery,
    MethodLog,
    MongooseRepository,
    MongooseUpdateResult,
    objectId,
    objectIds,
    validateFilters
} from 'common'
import { MongooseConfig } from 'config'
import { FilterQuery, Model } from 'mongoose'
import { SalesStatusByShowtimeDto, TicketCreateDto } from './dtos'
import { TicketFilterDto } from './dtos/ticket-filter.dto'
import { Ticket, TicketStatus } from './models'

@Injectable()
export class TicketsRepository extends MongooseRepository<Ticket> {
    constructor(@InjectModel(Ticket.name, MongooseConfig.connName) model: Model<Ticket>) {
        super(model)
    }

    @MethodLog()
    async createTickets(createDtos: TicketCreateDto[]) {
        const tickets = createDtos.map((dto) => {
            const ticket = this.newDocument()
            ticket.batchId = objectId(dto.batchId)
            ticket.movieId = objectId(dto.movieId)
            ticket.theaterId = objectId(dto.theaterId)
            ticket.showtimeId = objectId(dto.showtimeId)
            ticket.status = dto.status
            ticket.seat = dto.seat

            return ticket
        })

        return this.saveMany(tickets)
    }

    @MethodLog()
    async updateTicketStatus(ticketIds: string[], status: TicketStatus) {
        const result = await this.model.updateMany(
            { _id: { $in: objectIds(ticketIds) } },
            { $set: { status } }
        )

        return result as MongooseUpdateResult
    }

    @MethodLog({ level: 'verbose' })
    async findAllTickets(filterDto: TicketFilterDto) {
        const { batchIds, movieIds, theaterIds, showtimeIds } = filterDto

        const query: FilterQuery<Ticket> = {}
        addInQuery(query, 'batchId', batchIds)
        addInQuery(query, 'movieId', movieIds)
        addInQuery(query, 'theaterId', theaterIds)
        addInQuery(query, 'showtimeId', showtimeIds)

        validateFilters(query)

        const tickets = await this.model.find(query).sort({ batchId: 1 }).exec()
        return tickets
    }

    @MethodLog({ level: 'verbose' })
    async getSalesStatuses(showtimeIds: string[]) {
        const salesStatuses = await this.model.aggregate([
            { $match: { showtimeId: { $in: objectIds(showtimeIds) } } },
            {
                $group: {
                    _id: '$showtimeId',
                    total: { $sum: 1 },
                    sold: {
                        $sum: {
                            $cond: [{ $eq: ['$status', TicketStatus.sold] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    showtimeId: { $toString: '$_id' },
                    total: 1,
                    sold: 1,
                    available: { $subtract: ['$total', '$sold'] }
                }
            }
        ])

        return salesStatuses as SalesStatusByShowtimeDto[]
    }
}

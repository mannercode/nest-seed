import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
    MethodLog,
    MongooseRepository,
    MongooseUpdateResult,
    objectId,
    objectIds,
    SchemeBody
} from 'common'
import { FilterQuery, Model } from 'mongoose'
import { TicketSalesStatusDto } from './dto'
import { TicketFilterDto } from './dto/ticket-filter.dto'
import { Ticket, TicketStatus } from './schemas'

@Injectable()
export class TicketsRepository extends MongooseRepository<Ticket> {
    constructor(@InjectModel(Ticket.name) model: Model<Ticket>) {
        super(model)
    }

    async onModuleInit() {
        await this.model.createCollection()
    }

    @MethodLog()
    async createTickets(createDtos: SchemeBody<Ticket>[]) {
        const tickets = createDtos.map((dto) => {
            const ticket = this.newDocument()
            ticket.batchId = objectId(dto.batchId)
            ticket.showtimeId = objectId(dto.showtimeId)
            ticket.theaterId = objectId(dto.theaterId)
            ticket.movieId = objectId(dto.movieId)
            ticket.status = dto.status
            ticket.seat = dto.seat

            return ticket
        })

        return this.saveAll(tickets)
    }

    @MethodLog()
    async updateTicketStatus(
        ticketIds: string[],
        status: TicketStatus
    ): Promise<MongooseUpdateResult> {
        const result = await this.model.updateMany(
            { _id: { $in: objectIds(ticketIds) } },
            { $set: { status } }
        )

        return result
    }

    @MethodLog({ level: 'verbose' })
    async findAllTickets(filterDto: TicketFilterDto) {
        const { batchIds, movieIds, theaterIds, showtimeIds } = filterDto

        const query: FilterQuery<Ticket> = {}
        if (batchIds) query.batchId = { $in: objectIds(batchIds) }
        if (movieIds) query.movieId = { $in: objectIds(movieIds) }
        if (theaterIds) query.theaterId = { $in: objectIds(theaterIds) }
        if (showtimeIds) query.showtimeId = { $in: objectIds(showtimeIds) }

        if (Object.keys(query).length === 0) {
            throw new BadRequestException('At least one filter condition must be provided.')
        }

        const tickets = await this.model.find(query).sort({ batchId: 1 }).exec()
        return tickets as Ticket[]
    }

    @MethodLog({ level: 'verbose' })
    async getSalesStatuses(showtimeIds: string[]): Promise<TicketSalesStatusDto[]> {
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

        return salesStatuses
    }
}

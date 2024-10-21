import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
    addInQuery,
    addRangeQuery,
    MethodLog,
    ModelAttributes,
    MongooseRepository,
    ObjectId,
    validateFilters
} from 'common'
import { FilterQuery, Model } from 'mongoose'
import { ShowtimeFilterDto } from './dtos'
import { Showtime } from './models'

@Injectable()
export class ShowtimesRepository extends MongooseRepository<Showtime> {
    constructor(@InjectModel(Showtime.name) model: Model<Showtime>) {
        super(model)
    }

    async onModuleInit() {
        await this.model.createCollection()
    }

    @MethodLog()
    async createShowtimes(createDtos: ModelAttributes<Showtime>[]) {
        const showtimes = createDtos.map((dto) => {
            const document = this.newDocument()
            Object.assign(document, dto)
            return document
        })

        await this.saveAll(showtimes)
    }

    @MethodLog({ level: 'verbose' })
    async getShowtime(showtimeId: ObjectId) {
        const showtime = await this.findById(showtimeId)

        if (!showtime) throw new NotFoundException(`Showtime with ID ${showtimeId} not found`)

        return showtime
    }

    @MethodLog({ level: 'verbose' })
    async findAllShowtimes(filterDto: ShowtimeFilterDto) {
        const { batchIds, movieIds, theaterIds, startTimeRange, endTimeRange } = filterDto

        const query: FilterQuery<Showtime> = {}
        addInQuery(query, 'batchId', batchIds)
        addInQuery(query, 'movieId', movieIds)
        addInQuery(query, 'theaterId', theaterIds)
        addRangeQuery(query, 'startTime', startTimeRange)
        addRangeQuery(query, 'endTime', endTimeRange)

        validateFilters(query)

        const showtimes = await this.model.find(query).sort({ startTime: 1 }).exec()
        return showtimes as Showtime[]
    }

    @MethodLog({ level: 'verbose' })
    async findMovieIdsShowingAfter(time: Date) {
        const movieIds = await this.model.distinct('movieId', { startTime: { $gt: time } }).exec()
        return movieIds.map((id) => id.toString())
    }

    @MethodLog({ level: 'verbose' })
    async findTheaterIdsShowingMovie(movieId: ObjectId) {
        const theaterIds = await this.model.distinct('theaterId', { movieId }).exec()
        return theaterIds.map((id) => id.toString())
    }

    @MethodLog({ level: 'verbose' })
    async findShowdates(movieId: ObjectId, theaterId: ObjectId) {
        const showdates = await this.model.aggregate([
            { $match: { movieId, theaterId } },
            { $project: { date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } } } },
            { $group: { _id: '$date' } },
            { $sort: { _id: 1 } }
        ])

        return showdates.map((item) => new Date(item._id))
    }
}

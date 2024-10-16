import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MethodLog, ModelAttributes, MongooseRepository, ObjectId, objectIds } from 'common'
import { FilterQuery, Model } from 'mongoose'
import { ShowtimeFilterDto } from './dto'
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
    async createShowtimes(creationDtos: ModelAttributes<Showtime>[]) {
        const showtimes = creationDtos.map((dto) => {
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
        const { batchIds, movieIds, theaterIds, startTimeRange } = filterDto

        const query: FilterQuery<Showtime> = {}
        if (batchIds) query.batchId = { $in: objectIds(batchIds) }
        if (movieIds) query.movieId = { $in: objectIds(movieIds) }
        if (theaterIds) query.theaterId = { $in: objectIds(theaterIds) }
        if (startTimeRange)
            query.startTime = { $gte: startTimeRange.start, $lte: startTimeRange.end }

        if (Object.keys(query).length === 0) {
            throw new BadRequestException('At least one filter condition must be provided.')
        }

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

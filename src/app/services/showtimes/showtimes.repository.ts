import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MethodLog, MongooseRepository, objectId, objectIds, PaginationResult } from 'common'
import { FilterQuery, Model } from 'mongoose'
import { ShowtimeQueryDto, ShowtimeCreationDto, ShowtimeFilterDto } from './dto'
import { Showtime } from './schemas'

@Injectable()
export class ShowtimesRepository extends MongooseRepository<Showtime> {
    constructor(@InjectModel(Showtime.name) model: Model<Showtime>) {
        super(model)
    }

    async onModuleInit() {
        await this.model.createCollection()
    }

    @MethodLog()
    async createShowtimes(creationDtos: ShowtimeCreationDto[]) {
        const showtimes = creationDtos.map((dto) => {
            const showtime = this.newDocument()
            showtime.batchId = objectId(dto.batchId)
            showtime.theaterId = objectId(dto.theaterId)
            showtime.movieId = objectId(dto.movieId)
            showtime.startTime = dto.startTime
            showtime.endTime = dto.endTime

            return showtime
        })

        await this.saveAll(showtimes)
    }

    @MethodLog({ level: 'verbose' })
    async getShowtime(showtimeId: string) {
        const showtime = await this.findById(showtimeId)

        if (!showtime) throw new NotFoundException(`Showtime with ID ${showtimeId} not found`)

        return showtime
    }

    @MethodLog({ level: 'verbose' })
    async findAllShowtimes(filterDto: ShowtimeFilterDto) {
        const { batchId, movieId, theaterId, startTimeRange } = filterDto

        const query: FilterQuery<Showtime> = {}
        if (batchId) query.batchId = objectId(batchId)
        if (movieId) query.movieId = objectId(movieId)
        if (theaterId) query.theaterId = objectId(theaterId)
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
    async findTheaterIdsShowingMovie(movieId: string) {
        const theaterIds = await this.model
            .distinct('theaterId', { movieId: objectId(movieId) })
            .exec()
        return theaterIds.map((id) => id.toString())
    }

    @MethodLog({ level: 'verbose' })
    async findShowdates(movieId: string, theaterId: string) {
        const showdates = await this.model.aggregate([
            { $match: { movieId: objectId(movieId), theaterId: objectId(theaterId) } },
            { $project: { date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } } } },
            { $group: { _id: '$date' } },
            { $sort: { _id: 1 } }
        ])

        return showdates.map((item) => new Date(item._id))
    }
}

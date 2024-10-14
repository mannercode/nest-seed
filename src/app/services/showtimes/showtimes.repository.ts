import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
    MethodLog,
    MongooseRepository,
    objectId,
    objectIds,
    PaginationResult
} from 'common'
import { FilterQuery, Model } from 'mongoose'
import { ShowtimeQueryDto, ShowtimeCreationDto } from './dto'
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
    async findShowtimes(queryDto: ShowtimeQueryDto) {
        const { showtimeIds, movieId, theaterId, batchId, ...pagination } = queryDto

        const paginated = await this.findWithPagination((helpers) => {
            const query: FilterQuery<Showtime> = {}
            if (showtimeIds) query._id = { $in: objectIds(showtimeIds) }
            if (movieId) query.movieId = objectId(movieId)
            if (theaterId) query.theaterId = objectId(theaterId)
            if (batchId) query.batchId = objectId(batchId)

            helpers.setQuery(query)
        }, pagination)

        return paginated as PaginationResult<Showtime>
    }

    @MethodLog({ level: 'verbose' })
    async findShowtimesByBatchId(batchId: string) {
        const showtimes = await this.model.find({ batchId: objectId(batchId) }).exec()
        return showtimes as Showtime[]
    }

    @MethodLog({ level: 'verbose' })
    async findShowtimesByShowdate(movieId: string, theaterId: string, showdate: Date) {
        const startOfDay = new Date(showdate)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(showdate)
        endOfDay.setHours(23, 59, 59, 999)

        const showtimes = await this.model
            .find({
                movieId: objectId(movieId),
                theaterId: objectId(theaterId),
                startTime: { $gte: startOfDay, $lte: endOfDay }
            })
            .sort({ startTime: 1 })
            .exec()

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

    @MethodLog({ level: 'verbose' })
    async findShowtimesWithinDateRange(theaterId: string, startTime: Date, endTime: Date) {
        /**
         * 이전에 등록된 상영 시간을 검색할 때는 시작 시간만 사용해야 합니다.
         * 시작시간과 종료시간을 입력값으로 받더라도 시작시간과 종료시간을 모두 사용하여 검색해서는 안 됩니다.
         */
        const showtimes = await this.model
            .find({
                theaterId: objectId(theaterId),
                startTime: { $gte: startTime, $lte: endTime }
            })
            .exec()
        return showtimes as Showtime[]
    }
}

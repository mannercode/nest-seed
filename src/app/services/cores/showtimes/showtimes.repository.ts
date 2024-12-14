import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
    addInQuery,
    addRangeQuery,
    MethodLog,
    MongooseRepository,
    objectId,
    validateFilters
} from 'common'
import { MongooseConfig } from 'config'
import { FilterQuery, Model } from 'mongoose'
import { ShowtimeCreateDto, ShowtimeFilterDto } from './dtos'
import { Showtime } from './models'

@Injectable()
export class ShowtimesRepository extends MongooseRepository<Showtime> {
    constructor(@InjectModel(Showtime.name, MongooseConfig.connName) model: Model<Showtime>) {
        super(model)
    }

    @MethodLog()
    async createShowtimes(createDtos: ShowtimeCreateDto[]) {
        const showtimes = createDtos.map((dto) => {
            const doc = this.newDocument()
            doc.movieId = objectId(dto.movieId)
            doc.theaterId = objectId(dto.theaterId)
            doc.startTime = dto.startTime
            doc.endTime = dto.endTime
            doc.batchId = objectId(dto.batchId)

            return doc
        })

        await this.saveMany(showtimes)
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
        return showtimes
    }

    @MethodLog({ level: 'verbose' })
    async findMovieIdsShowingAfter(time: Date) {
        const movieIds = await this.model.distinct('movieId', { startTime: { $gt: time } }).exec()
        return movieIds.map((id) => id.toString())
    }

    @MethodLog({ level: 'verbose' })
    async findTheaterIdsByMovieId(movieId: string) {
        const theaterIds = await this.model
            .distinct('theaterId', { movieId: objectId(movieId) })
            .exec()
        return theaterIds.map((id) => id.toString())
    }

    @MethodLog({ level: 'verbose' })
    async findShowdates(args: { movieId: string; theaterId: string }) {
        const { movieId, theaterId } = args

        const showdates = await this.model.aggregate([
            { $match: { movieId: objectId(movieId), theaterId: objectId(theaterId) } },
            { $project: { date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } } } },
            { $group: { _id: '$date' } },
            { $sort: { _id: 1 } }
        ])

        return showdates.map((item) => new Date(item._id))
    }
}

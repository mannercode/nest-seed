import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseRepository, objectId, QueryBuilder, QueryBuilderOptions } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreateShowtimeDto, SearchShowtimesDto } from './dtos'
import { Showtime } from './models'

@Injectable()
export class ShowtimesRepository extends MongooseRepository<Showtime> {
    constructor(
        @InjectModel(Showtime.name, MongooseConfigModule.connectionName) model: Model<Showtime>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async createShowtimes(createDtos: CreateShowtimeDto[]) {
        const showtimes = createDtos.map((dto) => {
            const doc = this.newDocument()
            doc.transactionId = objectId(dto.transactionId)
            doc.movieId = objectId(dto.movieId)
            doc.theaterId = objectId(dto.theaterId)
            doc.startTime = dto.startTime
            doc.endTime = dto.endTime

            return doc
        })

        await this.saveMany(showtimes)
    }

    async searchShowtimes(searchDto: SearchShowtimesDto) {
        const query = this.buildQuery(searchDto)

        const showtimes = await this.model.find(query).sort({ startTime: 1 }).exec()
        return showtimes
    }

    async searchMovieIds(searchDto: SearchShowtimesDto) {
        const query = this.buildQuery(searchDto)

        const movieIds = await this.model.distinct('movieId', query).exec()
        return movieIds.map((id) => id.toString())
    }

    async searchTheaterIds(searchDto: SearchShowtimesDto) {
        const query = this.buildQuery(searchDto)

        const theaterIds = await this.model.distinct('theaterId', query).exec()
        return theaterIds.map((id) => id.toString())
    }

    async searchShowdates(searchDto: SearchShowtimesDto) {
        const query = this.buildQuery(searchDto)

        const showdates = await this.model.aggregate([
            { $match: query },
            {
                $project: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } }
                }
            },
            { $group: { _id: '$date' } },
            { $sort: { _id: 1 } }
        ])

        return showdates.map((item) => new Date(item._id))
    }

    private buildQuery(searchDto: SearchShowtimesDto, options: QueryBuilderOptions = {}) {
        const { transactionIds, movieIds, theaterIds, startTimeRange, endTimeRange } = searchDto

        const builder = new QueryBuilder<Showtime>()
        builder.addIn('transactionId', transactionIds)
        builder.addIn('movieId', movieIds)
        builder.addIn('theaterId', theaterIds)
        builder.addRange('startTime', startTimeRange)
        builder.addRange('endTime', endTimeRange)

        const query = builder.build(options)
        return query
    }
}

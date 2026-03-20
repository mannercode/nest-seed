import { QueryBuilderOptions } from '@mannercode/nest-common'
import { MongooseRepository, QueryBuilder } from '@mannercode/nest-common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'app-common'
import { Model } from 'mongoose'
import { CreateShowtimeDto, SearchShowtimesDto } from './dtos'
import { Showtime } from './models'

@Injectable()
export class ShowtimesRepository extends MongooseRepository<Showtime> {
    constructor(
        @InjectModel(Showtime.name, MongooseConfigModule.connectionName)
        readonly model: Model<Showtime>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async deleteBySagaIds(sagaIds: string[]) {
        await this.model.deleteMany({ sagaId: { $in: sagaIds } })
    }

    async createMany(createDtos: CreateShowtimeDto[]) {
        const showtimes = createDtos.map((dto) => {
            const doc = this.newDocument()
            doc.sagaId = dto.sagaId
            doc.movieId = dto.movieId
            doc.theaterId = dto.theaterId
            doc.startTime = dto.startTime
            doc.endTime = dto.endTime

            return doc
        })

        await this.saveMany(showtimes)
    }

    async search(searchDto: SearchShowtimesDto) {
        const query = this.buildQuery(searchDto)

        const showtimes = await this.model
            .find(query)
            .sort({ startTime: 1 })
            .lean({ virtuals: true })
            .exec()
        return showtimes
    }

    async searchMovieIds(searchDto: SearchShowtimesDto) {
        const query = this.buildQuery(searchDto)

        const movieIds = await this.model.distinct('movieId', query).exec()
        return movieIds.map((id) => id.toString())
    }

    async searchShowdates(searchDto: SearchShowtimesDto) {
        const query = this.buildQuery(searchDto)

        const showdates = await this.model.aggregate([
            { $match: query },
            { $project: { date: { $dateToString: { date: '$startTime', format: '%Y-%m-%d' } } } },
            { $group: { _id: '$date' } },
            { $sort: { _id: 1 } }
        ])

        return showdates.map((item) => new Date(item._id))
    }

    async searchTheaterIds(searchDto: SearchShowtimesDto) {
        const query = this.buildQuery(searchDto)

        const theaterIds = await this.model.distinct('theaterId', query).exec()
        return theaterIds.map((id) => id.toString())
    }

    private buildQuery(searchDto: SearchShowtimesDto, options: QueryBuilderOptions = {}) {
        const { endTimeRange, movieIds, sagaIds, startTimeRange, theaterIds } = searchDto

        const builder = new QueryBuilder<Showtime>()
        builder.addIn('sagaId', sagaIds)
        builder.addIn('movieId', movieIds)
        builder.addIn('theaterId', theaterIds)
        builder.addRange('startTime', startTimeRange)
        builder.addRange('endTime', endTimeRange)

        const query = builder.build(options)
        return query
    }
}

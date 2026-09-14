import {
    type TransactionContext,
    QueryBuilderOptions,
    CrudRepository,
    QueryBuilder,
    MongoConnection
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import { CreateShowtimeDto, SearchShowtimesDto } from './dtos/index.js'
import { Showtime } from './models/index.js'

@Injectable()
export class ShowtimesRepository extends CrudRepository<Showtime> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection,
            'showtimes',
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize,
            {
                hardDelete: true,
                indexes: [{ key: { theaterId: 1, startTime: 1 } }, { key: { sagaId: 1 } }]
            }
        )
    }

    async createMany(
        createDtos: CreateShowtimeDto[],
        transaction: TransactionContext | undefined = undefined,
        signal: AbortSignal | undefined = undefined
    ) {
        const showtimes = createDtos.map((dto) => {
            const doc = this.newDocument()
            doc.sagaId = dto.sagaId
            doc.movieId = dto.movieId
            doc.theaterId = dto.theaterId
            doc.startTime = dto.startTime
            doc.endTime = dto.endTime

            return doc
        })

        await this.insertMany(showtimes, transaction, signal)
    }

    async existsByMovieIds(movieIds: string[]): Promise<boolean> {
        const found = await this.findDocument(
            { movieId: { $in: movieIds } },
            { projection: { _id: 1 } }
        )
        return !!found
    }

    async existsByTheaterIds(theaterIds: string[]): Promise<boolean> {
        const found = await this.findDocument(
            { theaterId: { $in: theaterIds } },
            { projection: { _id: 1 } }
        )
        return !!found
    }

    async search(
        searchDto: SearchShowtimesDto,
        transaction: TransactionContext | undefined = undefined,
        signal: AbortSignal | undefined = undefined
    ) {
        const query = this.buildQuery(searchDto)

        const showtimes = await this.findDocuments(query, {
            transaction,
            signal,
            sort: { startTime: 1 }
        })
        return showtimes
    }

    async searchMovieIds(searchDto: SearchShowtimesDto) {
        const query = this.buildQuery(searchDto)

        const movieIds = await this.distinctValues<string>('movieId', query)
        return movieIds.map((id) => id.toString())
    }

    async searchShowdates(searchDto: SearchShowtimesDto) {
        const query = this.buildQuery(searchDto)

        const showdates = await this.aggregateDocuments<{ _id: string }>([
            { $match: query },
            { $project: { date: { $dateToString: { date: '$startTime', format: '%Y-%m-%d' } } } },
            { $group: { _id: '$date' } },
            { $sort: { _id: 1 } }
        ])

        return showdates.map((item) => Temporal.PlainDate.from(item._id))
    }

    async searchTheaterIds(searchDto: SearchShowtimesDto) {
        const query = this.buildQuery(searchDto)

        const theaterIds = await this.distinctValues<string>('theaterId', query)
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

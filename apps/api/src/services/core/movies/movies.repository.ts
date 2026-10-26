import {
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    plainDateFromMongo,
    MongoErrors,
    QueryBuilder,
    MongoConnection,
    DateUtil,
    type TransactionContext
} from '@mannercode/common'
import { Injectable, NotFoundException } from '@nestjs/common'
import { z } from 'zod'
import { AppConfigService } from '#config'
import { SearchMoviesPageDto, UpsertMovieDto } from './dtos/index.js'
import { Movie, MovieDefaults, MovieGenre, MovieRating } from './models/index.js'
import { MovieErrors } from './errors.js'

const StoredMovieSchema = z.object({
    assetIds: z.array(z.string()),
    director: z.string(),
    durationInSeconds: z.number(),
    genres: z.array(z.enum(MovieGenre)),
    isPublished: z.boolean(),
    plot: z.string(),
    rating: z.enum(MovieRating),
    releaseDate: z.instanceof(Temporal.PlainDate),
    title: z.string()
})

@Injectable()
export class MoviesRepository extends CrudRepository<Movie> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection,
            'movies',
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize
        )
    }

    async addAsset(movieId: string, assetId: string, transaction?: TransactionContext) {
        // 동시에 완료 요청을 처리해도 동일한 assetId는 한 번만 연결한다.
        const result = await this.updateDocument(
            this.activeFilter({ ...this.idFilter(movieId), deletionRequestedAt: null }),
            this.timestamped({ $addToSet: { assetIds: assetId } }),
            { transaction }
        )
        if (result.matchedCount === 0) throw new NotFoundException(MovieErrors.NotFound(movieId))
    }

    async touchForAssetChange(movieId: string, transaction: TransactionContext) {
        const result = await this.updateDocument(
            this.activeFilter({ ...this.idFilter(movieId), deletionRequestedAt: null }),
            this.timestamped({}),
            { transaction }
        )
        if (result.matchedCount === 0) throw new NotFoundException(MovieErrors.NotFound(movieId))
    }

    async requestDeletion(movieIds: string[]) {
        await this.updateDocuments(
            this.activeFilter({ ...this.idsFilter(movieIds), deletionRequestedAt: null }),
            this.timestamped({ $set: { deletionRequestedAt: DateUtil.now() } })
        )
        return this.findMany({ ids: movieIds })
    }

    async removeAsset(movieId: string, assetId: string) {
        // load→filter→save는 같은 movie의 다른 asset을 동시에 만지면 한쪽 변경을 덮어쓴다(lost update).
        // $pull은 항목 단위 원자 갱신이라 그 충돌이 없다. addAsset($addToSet)과 짝을 이룬다.
        await this.updateDocument(
            this.activeFilter(this.idFilter(movieId)),
            this.timestamped({ $pull: { assetIds: assetId } })
        )
    }

    async findAssetIds(): Promise<string[]> {
        return this.distinctValues<string>('assetIds', this.activeFilter({}))
    }

    async removeAssets(assetIds: string[]): Promise<void> {
        await this.updateDocuments(
            this.activeFilter({ assetIds: { $in: assetIds } }),
            this.timestamped({ $pull: { assetIds: { $in: assetIds } } })
        )
    }

    async create(upsertDto: UpsertMovieDto) {
        const movie = this.newDocument()
        movie.assetIds = []
        movie.deletionRequestedAt = null
        movie.director = MovieDefaults.director
        movie.durationInSeconds = MovieDefaults.durationInSeconds
        movie.genres = []
        movie.isPublished = false
        movie.plot = MovieDefaults.plot
        movie.rating = MovieDefaults.rating
        movie.releaseDate = MovieDefaults.releaseDate
        movie.title = MovieDefaults.title

        this.applyUpsertDto(movie, upsertDto)
        StoredMovieSchema.parse(movie)
        return this.insertOne(movie)
    }

    async getForUpdate(movieId: string) {
        const stored = await this.findDocument(this.activeFilter(this.idFilter(movieId)))
        if (!stored) throw new NotFoundException(MongoErrors.DocumentNotFound(movieId))

        return { movie: this.toDomainDocument(stored), version: stored.__v }
    }

    async searchPage(searchDto: SearchMoviesPageDto) {
        const { orderby, page, size } = searchDto

        const pagination = await this.findWithPagination({
            filter: this.buildQuery(searchDto, { allowEmpty: true }),
            pagination: {
                orderby: orderby ?? undefined,
                page: page ?? undefined,
                size: size ?? undefined
            }
        })

        return pagination
    }

    async update(movie: Movie, version: number) {
        const fields = StoredMovieSchema.parse(movie)
        const updated = await this.findAndUpdateDocument(
            this.activeFilter({ ...this.idFilter(movie.id), __v: version }),
            this.timestamped({ $set: fields }),
            { returnDocument: 'after' }
        )
        return updated ? this.toDomainDocument(updated) : null
    }

    private applyUpsertDto(movie: Movie, dto: UpsertMovieDto) {
        assignIfDefined(movie, dto, 'title')
        assignIfDefined(movie, dto, 'genres')
        assignIfDefined(movie, dto, 'releaseDate')
        assignIfDefined(movie, dto, 'plot')
        assignIfDefined(movie, dto, 'durationInSeconds')
        assignIfDefined(movie, dto, 'director')
        assignIfDefined(movie, dto, 'rating')
    }

    private buildQuery(searchDto: SearchMoviesPageDto, options: QueryBuilderOptions) {
        const { director, genre, plot, rating, releaseDate, title } = searchDto

        const builder = new QueryBuilder()
        builder.addEquals('isPublished', true)
        builder.addRegex('title', title ?? undefined)
        builder.addEquals('genres', genre)
        builder.addEquals('releaseDate', releaseDate)
        builder.addRegex('plot', plot ?? undefined)
        builder.addRegex('director', director ?? undefined)
        builder.addEquals('rating', rating)

        const query = builder.build(options)
        return query
    }

    protected override toDomainDocument(doc: Movie): Movie {
        const movie = super.toDomainDocument(doc)
        movie.releaseDate = plainDateFromMongo(movie.releaseDate)
        return movie
    }
}

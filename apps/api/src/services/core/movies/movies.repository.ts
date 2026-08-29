import type { Document } from 'mongodb'
import {
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    mongoToPublic,
    MongoErrors,
    objectId,
    QueryBuilder
} from '@mannercode/common'
import { Injectable, NotFoundException } from '@nestjs/common'
import { z } from 'zod'
import { AppConfigService, MongoConnection } from '#config'
import { SearchMoviesPageDto, UpsertMovieDto } from './dtos/index.js'
import { Movie, MovieDefaults, MovieGenre, MovieRating } from './models/index.js'

const MOVIE_CAS_ATTEMPTS = 5
const StoredMovieSchema = z.object({
    assetIds: z.array(z.string()),
    director: z.string(),
    durationInSeconds: z.number(),
    genres: z.array(z.enum(MovieGenre)),
    isPublished: z.boolean(),
    plot: z.string(),
    rating: z.enum(MovieRating),
    releaseDate: z.date(),
    title: z.string()
})

@Injectable()
export class MoviesRepository extends CrudRepository<Movie> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection.db.collection('movies'),
            connection.client,
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize
        )
    }

    async addAsset(movieId: string, assetId: string) {
        // finalize가 동시에 두 번 들어오면 load→push→save가 같은 옛 배열을 읽어 assetId를 중복 추가한다.
        // $addToSet은 단일 문서 원자 연산이라 중복을 차단한다 — 트랜잭션·락 없이 끝난다.
        await this.collection.updateOne(
            this.activeFilter({ _id: objectId(movieId) }),
            this.timestamped({ $addToSet: { assetIds: assetId } })
        )
    }

    async removeAsset(movieId: string, assetId: string) {
        // load→filter→save는 같은 movie의 다른 asset을 동시에 만지면 한쪽 변경을 덮어쓴다(lost update).
        // $pull은 항목 단위 원자 갱신이라 그 충돌이 없다. addAsset($addToSet)과 짝을 이룬다.
        await this.collection.updateOne(
            this.activeFilter({ _id: objectId(movieId) }),
            this.timestamped({ $pull: { assetIds: assetId } })
        )
    }

    async create(upsertDto: UpsertMovieDto) {
        const movie = this.newDocument()
        movie.assetIds = []
        movie.director = MovieDefaults.director
        movie.durationInSeconds = MovieDefaults.durationInSeconds
        movie.genres = []
        movie.isPublished = false
        movie.plot = MovieDefaults.plot
        movie.rating = MovieDefaults.rating
        movie.releaseDate = new Date(MovieDefaults.releaseDate.getTime())
        movie.title = MovieDefaults.title

        this.applyUpsertDto(movie, upsertDto)
        this.validate(movie)
        return this.insertOne(movie)
    }

    async publish(movieId: string) {
        return this.updateWithCas(movieId, { isPublished: true })
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

    async update(movieId: string, upsertDto: UpsertMovieDto) {
        const fields: Partial<Movie> = {}
        this.applyUpsertDto(fields as Movie, upsertDto)
        return this.updateWithCas(movieId, fields)
    }

    private applyUpsertDto(movie: Movie, dto: UpsertMovieDto) {
        assignIfDefined(movie, dto, 'title')
        assignIfDefined(movie, dto, 'genres')
        assignIfDefined(movie, dto, 'releaseDate')
        assignIfDefined(movie, dto, 'plot')
        assignIfDefined(movie, dto, 'durationInSeconds')
        assignIfDefined(movie, dto, 'director')
        assignIfDefined(movie, dto, 'rating')
        assignIfDefined(movie, dto, 'assetIds')
    }

    private async updateWithCas(movieId: string, fields: Partial<Movie>) {
        const _id = objectId(movieId)

        for (let attempt = 0; attempt < MOVIE_CAS_ATTEMPTS; attempt++) {
            const stored = await this.collection.findOne(this.activeFilter({ _id }))
            if (!stored) throw new NotFoundException(MongoErrors.DocumentNotFound(movieId))

            const current = mongoToPublic<Movie>(stored)
            const next = { ...current, ...fields }
            this.validate(next)

            const updated = await this.collection.findOneAndUpdate(
                this.activeFilter({ _id, __v: stored.__v }),
                this.timestamped({ $set: fields as Document }),
                { returnDocument: 'after' }
            )
            if (updated) return mongoToPublic<Movie>(updated)
        }

        throw new Error(`Movie update did not converge after ${MOVIE_CAS_ATTEMPTS} attempts`)
    }

    private validate(movie: Movie) {
        StoredMovieSchema.parse(movie)
        if (!movie.isPublished) return
        if (movie.durationInSeconds <= 0) {
            throw new Error('Published movies must have a duration of at least 1 second')
        }
        if (movie.genres.length === 0) {
            throw new Error('Published movies must have at least one genre')
        }
        if (movie.rating === MovieDefaults.rating) {
            throw new Error('Published movies cannot be unrated')
        }
        if (movie.releaseDate.getTime() === MovieDefaults.releaseDate.getTime()) {
            throw new Error('Published movies must have a release date')
        }
        for (const [field, value] of [
            ['director', movie.director],
            ['plot', movie.plot],
            ['title', movie.title]
        ] as const) {
            if (!value) throw new Error(`Published movies must have ${field}`)
        }
    }

    private buildQuery(searchDto: SearchMoviesPageDto, options: QueryBuilderOptions) {
        const { director, genre, plot, rating, releaseDate, title } = searchDto

        const builder = new QueryBuilder<Movie>()
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
}

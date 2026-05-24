import {
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    QueryBuilder
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { HydratedDocument, Model } from 'mongoose'
import { SearchMoviesPageDto, UpsertMovieDto } from './dtos'
import { Movie } from './models'

@Injectable()
export class MoviesRepository extends CrudRepository<Movie> {
    constructor(
        @InjectModel(Movie.name, MONGO_CONNECTION_NAME) readonly model: Model<Movie>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize)
    }

    async addAsset(movieId: string, assetId: string) {
        const movie = await this.getDocumentById(movieId)
        movie.assetIds.push(assetId)
        await movie.save()
    }

    async removeAsset(movieId: string, assetId: string) {
        const movie = await this.getDocumentById(movieId)
        movie.assetIds = movie.assetIds.filter((id) => id !== assetId)
        await movie.save()
    }

    async create(upsertDto: UpsertMovieDto) {
        const movie = this.newDocument()

        await this.applyUpsertDto(movie, upsertDto)

        return movie.toJSON()
    }

    async publish(movieId: string) {
        const movie = await this.getDocumentById(movieId)

        movie.isPublished = true

        await movie.save()

        return movie.toJSON()
    }

    async searchPage(searchDto: SearchMoviesPageDto) {
        const { orderby, page, size } = searchDto

        const pagination = await this.findWithPagination({
            configureQuery: async (queryHelper) => {
                const query = this.buildQuery(searchDto, { allowEmpty: true })

                queryHelper.setQuery(query)
            },
            pagination: { orderby, page, size }
        })

        return pagination
    }

    async update(movieId: string, upsertDto: UpsertMovieDto) {
        const movie = await this.getDocumentById(movieId)

        await this.applyUpsertDto(movie, upsertDto)

        return movie.toJSON()
    }

    private async applyUpsertDto(movie: HydratedDocument<Movie>, dto: UpsertMovieDto) {
        assignIfDefined(movie, dto, 'title')
        assignIfDefined(movie, dto, 'genres')
        assignIfDefined(movie, dto, 'releaseDate')
        assignIfDefined(movie, dto, 'plot')
        assignIfDefined(movie, dto, 'durationInSeconds')
        assignIfDefined(movie, dto, 'director')
        assignIfDefined(movie, dto, 'rating')
        assignIfDefined(movie, dto, 'assetIds')

        await movie.save()
    }

    private buildQuery(searchDto: SearchMoviesPageDto, options: QueryBuilderOptions) {
        const { director, genre, plot, rating, releaseDate, title } = searchDto

        const builder = new QueryBuilder<Movie>()
        builder.addEquals('isPublished', true)
        // API 계약은 대소문자를 구분하지 않는 부분 문자열 검색이다.
        // 일반 Mongo 인덱스를 활용하지 못하는 형태지만, 시드의 검색 동작을 명확히 보여 주려고 유지한다.
        builder.addRegex('title', title)
        builder.addEquals('genres', genre)
        builder.addEquals('releaseDate', releaseDate)
        builder.addRegex('plot', plot)
        builder.addRegex('director', director)
        builder.addEquals('rating', rating)

        const query = builder.build(options)
        return query
    }
}

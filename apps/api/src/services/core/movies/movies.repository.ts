import {
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    objectId,
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
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
    }

    async addAsset(movieId: string, assetId: string) {
        // finalize가 동시에 두 번 들어오면 load→push→save가 같은 옛 배열을 읽어 assetId를 중복 추가한다.
        // $addToSet은 단일 문서 원자 연산이라 중복을 차단한다 — 트랜잭션·락 없이 끝난다.
        await this.model.updateOne({ _id: objectId(movieId) }, { $addToSet: { assetIds: assetId } })
    }

    async removeAsset(movieId: string, assetId: string) {
        // load→filter→save는 같은 movie의 다른 asset을 동시에 만지면 한쪽 변경을 덮어쓴다(lost update).
        // $pull은 항목 단위 원자 갱신이라 그 충돌이 없다. addAsset($addToSet)과 짝을 이룬다.
        await this.model.updateOne({ _id: objectId(movieId) }, { $pull: { assetIds: assetId } })
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

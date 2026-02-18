import type { QueryBuilderOptions } from 'common'
import type { HydratedDocument, Model } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { assignDefined, MongooseRepository, QueryBuilder } from 'common'
import { MongooseConfigModule } from 'shared'
import type { SearchMoviesPageDto, UpsertMovieDto } from './dtos'
import { Movie } from './models'

@Injectable()
export class MoviesRepository extends MongooseRepository<Movie> {
    constructor(
        @InjectModel(Movie.name, MongooseConfigModule.connectionName) readonly model: Model<Movie>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async addAsset(movieId: string, assetId: string) {
        const movie = await this.getDocumentById(movieId)
        movie.assetIds.push(assetId)
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
        const { orderby, skip, take } = searchDto

        const pagination = await this.findWithPagination({
            configureQuery: async (queryHelper) => {
                const query = this.buildQuery(searchDto, { allowEmpty: true })

                queryHelper.setQuery(query)
            },
            pagination: { orderby, skip, take }
        })

        return pagination
    }

    async update(movieId: string, upsertDto: UpsertMovieDto) {
        const movie = await this.getDocumentById(movieId)

        await this.applyUpsertDto(movie, upsertDto)

        return movie.toJSON()
    }

    private async applyUpsertDto(movie: HydratedDocument<Movie>, dto: UpsertMovieDto) {
        assignDefined(movie, dto, 'title')
        assignDefined(movie, dto, 'genres')
        assignDefined(movie, dto, 'releaseDate')
        assignDefined(movie, dto, 'plot')
        assignDefined(movie, dto, 'durationInSeconds')
        assignDefined(movie, dto, 'director')
        assignDefined(movie, dto, 'rating')
        assignDefined(movie, dto, 'assetIds')

        await movie.save()
    }

    private buildQuery(searchDto: SearchMoviesPageDto, options: QueryBuilderOptions) {
        const { director, genre, plot, rating, releaseDate, title } = searchDto

        const builder = new QueryBuilder<Movie>()
        builder.addEqual('isPublished', true)
        builder.addRegex('title', title)
        builder.addEqual('genres', genre)
        builder.addEqual('releaseDate', releaseDate)
        builder.addRegex('plot', plot)
        builder.addRegex('director', director)
        builder.addEqual('rating', rating)

        const query = builder.build(options)
        return query
    }
}

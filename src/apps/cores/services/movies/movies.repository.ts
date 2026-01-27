import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { assignDefined, MongooseRepository, QueryBuilder, QueryBuilderOptions } from 'common'
import { HydratedDocument, Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { SearchMoviesPageDto, UpsertMovieDto } from './dtos'
import { Movie } from './models'

@Injectable()
export class MoviesRepository extends MongooseRepository<Movie> {
    constructor(
        @InjectModel(Movie.name, MongooseConfigModule.connectionName) readonly model: Model<Movie>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async create(upsertDto: UpsertMovieDto) {
        const movie = this.newDocument()

        await this.applyUpsertDto(movie, upsertDto)

        return movie.toJSON()
    }

    async update(movieId: string, upsertDto: UpsertMovieDto) {
        const movie = await this.getDocumentById(movieId)

        await this.applyUpsertDto(movie, upsertDto)

        return movie.toJSON()
    }

    async publish(movieId: string) {
        const movie = await this.getDocumentById(movieId)

        movie.isPublished = true

        await movie.save()

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

    async addAsset(movieId: string, assetId: string) {
        const movie = await this.getDocumentById(movieId)
        movie.assetIds.push(assetId)
        await movie.save()
    }

    async searchPage(searchDto: SearchMoviesPageDto) {
        const { take, skip, orderby } = searchDto

        const pagination = await this.findWithPagination({
            configureQuery: async (queryHelper) => {
                const query = this.buildQuery(searchDto, { allowEmpty: true })

                queryHelper.setQuery(query)
            },
            pagination: { take, skip, orderby }
        })

        return pagination
    }

    private buildQuery(searchDto: SearchMoviesPageDto, options: QueryBuilderOptions) {
        const { title, genre, releaseDate, plot, director, rating } = searchDto

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

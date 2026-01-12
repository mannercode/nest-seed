import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { assignDefined, MongooseRepository, QueryBuilder, QueryBuilderOptions } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreateMovieDto, SearchMoviesPageDto, UpdateMovieDto } from './dtos'
import { Movie } from './models'

@Injectable()
export class MoviesRepository extends MongooseRepository<Movie> {
    constructor(
        @InjectModel(Movie.name, MongooseConfigModule.connectionName) readonly model: Model<Movie>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async create(createDto: CreateMovieDto) {
        const movie = this.newDocument()
        movie.title = createDto.title
        movie.genres = createDto.genres
        movie.releaseDate = createDto.releaseDate
        movie.plot = createDto.plot
        movie.durationInSeconds = createDto.durationInSeconds
        movie.director = createDto.director
        movie.rating = createDto.rating
        movie.assetIds = createDto.assetIds

        await movie.save()

        return movie.toJSON()
    }

    async update(movieId: string, updateDto: UpdateMovieDto) {
        const movie = await this.getDocumentById(movieId)

        assignDefined(movie, updateDto, 'title')
        assignDefined(movie, updateDto, 'genres')
        assignDefined(movie, updateDto, 'releaseDate')
        assignDefined(movie, updateDto, 'plot')
        assignDefined(movie, updateDto, 'durationInSeconds')
        assignDefined(movie, updateDto, 'director')
        assignDefined(movie, updateDto, 'rating')
        assignDefined(movie, updateDto, 'assetIds')

        await movie.save()

        return movie.toJSON()
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

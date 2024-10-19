import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
    addRegexQuery,
    MethodLog,
    ModelAttributes,
    MongooseRepository,
    ObjectId,
    PaginationResult
} from 'common'
import { escapeRegExp } from 'lodash'
import { FilterQuery, Model } from 'mongoose'
import { MovieQueryDto } from './dto'
import { Movie } from './models'

@Injectable()
export class MoviesRepository extends MongooseRepository<Movie> {
    constructor(@InjectModel(Movie.name) model: Model<Movie>) {
        super(model)
    }

    async onModuleInit() {
        await this.model.createCollection()
    }

    @MethodLog()
    async createMovie(creationDto: ModelAttributes<Movie>) {
        const movie = this.newDocument()
        Object.assign(movie, creationDto)

        return movie.save()
    }

    @MethodLog()
    async updateMovie(movieId: ObjectId, updateDto: Partial<ModelAttributes<Movie>>) {
        const movie = await this.getMovie(movieId)

        if (updateDto.title) movie.title = updateDto.title
        if (updateDto.genre) movie.genre = updateDto.genre
        if (updateDto.releaseDate) movie.releaseDate = updateDto.releaseDate
        if (updateDto.plot) movie.plot = updateDto.plot
        if (updateDto.durationMinutes) movie.durationMinutes = updateDto.durationMinutes
        if (updateDto.director) movie.director = updateDto.director
        if (updateDto.rating) movie.rating = updateDto.rating

        return movie.save()
    }

    @MethodLog()
    async deleteMovie(movieId: ObjectId) {
        const movie = await this.getMovie(movieId)
        await movie.deleteOne()
    }

    @MethodLog({ level: 'verbose' })
    async getMovie(movieId: ObjectId) {
        const movie = await this.findById(movieId)

        if (!movie) throw new NotFoundException(`Movie with ID ${movieId} not found`)

        return movie
    }

    @MethodLog({ level: 'verbose' })
    async findMovies(queryDto: MovieQueryDto) {
        const { title, genre, releaseDate, plot, director, rating, ...pagination } = queryDto

        const paginated = await this.findWithPagination((helpers) => {
            const query: FilterQuery<Movie> = {}
            addRegexQuery(query, 'title', title)
            if (genre) query.genre = genre
            if (releaseDate) query.releaseDate = releaseDate
            addRegexQuery(query, 'plot', plot)
            addRegexQuery(query, 'director', director)
            if (rating) query.rating = rating

            helpers.setQuery(query)
        }, pagination)

        return paginated as PaginationResult<Movie>
    }

    // async getMoviesByIds(movieIds: string[]) {
    //     const uniqueIds = uniq(movieIds)

    //     Expect.equalLength(uniqueIds, movieIds, `Duplicate movie IDs are not allowed:${movieIds}`)

    //     const movies = await this.findByIds(uniqueIds)
    //     const notFoundIds = differenceWith(uniqueIds, movies, (id, movie) => id === movie.id)

    //     if (notFoundIds.length > 0) {
    //         throw new NotFoundException(
    //             `One or more movies with IDs ${notFoundIds.join(', ')} not found`
    //         )
    //     }

    //     return movies
    // }
}

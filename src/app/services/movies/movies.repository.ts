import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addRegexQuery, MethodLog, MongooseRepository, ObjectId, PaginationResult } from 'common'
import { FilterQuery, Model } from 'mongoose'
import { MovieQueryDto } from './dtos'
import { Movie, MovieCreatePayload, MovieUpdatePayload } from './models'

@Injectable()
export class MoviesRepository extends MongooseRepository<Movie> {
    constructor(@InjectModel(Movie.name) model: Model<Movie>) {
        super(model)
    }

    @MethodLog()
    async createMovie(payload: MovieCreatePayload) {
        const movie = this.newDocument()
        Object.assign(movie, payload)

        return movie.save()
    }

    @MethodLog()
    async updateMovie(movieId: ObjectId, payload: MovieUpdatePayload) {
        const movie = await this.getMovie(movieId)

        if (payload.title) movie.title = payload.title
        if (payload.genre) movie.genre = payload.genre
        if (payload.releaseDate) movie.releaseDate = payload.releaseDate
        if (payload.plot) movie.plot = payload.plot
        if (payload.durationMinutes) movie.durationMinutes = payload.durationMinutes
        if (payload.director) movie.director = payload.director
        if (payload.rating) movie.rating = payload.rating

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

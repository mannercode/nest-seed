import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addEqualQuery, addRegexQuery, MethodLog, MongooseRepository, ObjectId } from 'common'
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
        const movie = await this.getById(movieId)

        if (payload.title) movie.title = payload.title
        if (payload.genre) movie.genre = payload.genre
        if (payload.releaseDate) movie.releaseDate = payload.releaseDate
        if (payload.plot) movie.plot = payload.plot
        if (payload.durationMinutes) movie.durationMinutes = payload.durationMinutes
        if (payload.director) movie.director = payload.director
        if (payload.rating) movie.rating = payload.rating

        return movie.save()
    }

    @MethodLog({ level: 'verbose' })
    async findMovies(queryDto: MovieQueryDto) {
        const { title, genre, releaseDate, plot, director, rating, ...pagination } = queryDto

        const paginated = await this.findWithPagination((helpers) => {
            const query: FilterQuery<Movie> = {}
            addRegexQuery(query, 'title', title)
            addEqualQuery(query, 'genre', genre)
            addEqualQuery(query, 'releaseDate', releaseDate)
            addRegexQuery(query, 'plot', plot)
            addRegexQuery(query, 'director', director)
            addEqualQuery(query, 'rating', rating)

            helpers.setQuery(query)
        }, pagination)

        return paginated
    }
}

import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addEqualQuery, addRegexQuery, MethodLog, MongooseRepository, objectIds } from 'common'
import { MongooseConfig } from 'config'
import { FilterQuery, Model } from 'mongoose'
import { MovieCreateDto, MovieQueryDto, MovieUpdateDto } from './dtos'
import { Movie } from './models'

@Injectable()
export class MoviesRepository extends MongooseRepository<Movie> {
    constructor(@InjectModel(Movie.name, MongooseConfig.connName) model: Model<Movie>) {
        super(model)
    }

    @MethodLog()
    async createMovie(createDto: MovieCreateDto, storageFileIds: string[]) {
        const movie = this.newDocument()
        movie.title = createDto.title
        movie.genre = createDto.genre
        movie.releaseDate = createDto.releaseDate
        movie.plot = createDto.plot
        movie.durationMinutes = createDto.durationMinutes
        movie.director = createDto.director
        movie.rating = createDto.rating
        movie.imageFileIds = objectIds(storageFileIds)

        return movie.save()
    }

    @MethodLog()
    async updateMovie(movieId: string, updateDto: MovieUpdateDto) {
        const movie = await this.getById(movieId)

        if (updateDto.title) movie.title = updateDto.title
        if (updateDto.genre) movie.genre = updateDto.genre
        if (updateDto.releaseDate) movie.releaseDate = updateDto.releaseDate
        if (updateDto.plot) movie.plot = updateDto.plot
        if (updateDto.durationMinutes) movie.durationMinutes = updateDto.durationMinutes
        if (updateDto.director) movie.director = updateDto.director
        if (updateDto.rating) movie.rating = updateDto.rating

        return movie.save()
    }

    @MethodLog({ level: 'verbose' })
    async findMovies(queryDto: MovieQueryDto) {
        const { title, genre, releaseDate, plot, director, rating, ...pagination } = queryDto

        const paginated = await this.findWithPagination({
            callback: (helpers) => {
                const query: FilterQuery<Movie> = {}
                addRegexQuery(query, 'title', title)
                addEqualQuery(query, 'genre', genre)
                addEqualQuery(query, 'releaseDate', releaseDate)
                addRegexQuery(query, 'plot', plot)
                addRegexQuery(query, 'director', director)
                addEqualQuery(query, 'rating', rating)

                helpers.setQuery(query)
            },
            pagination
        })

        return paginated
    }
}

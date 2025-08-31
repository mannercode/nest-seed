import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { DateUtil, MongooseRepository } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { UpdateMovieDto } from './dtos'
import { Movie, MovieRating } from './models'

export class UpdateMovieDraftDto extends UpdateMovieDto {}

@Injectable()
export class MovieDraftsRepository extends MongooseRepository<Movie> {
    constructor(@InjectModel(Movie.name, MongooseConfigModule.connectionName) model: Model<Movie>) {
        super(model, MongooseConfigModule.maxTake)
    }

    async createMovieDraft() {
        const movie = this.newDocument()
        movie.title = ''
        movie.genres = []
        movie.releaseDate = DateUtil.now()
        movie.plot = ''
        movie.durationInSeconds = 0
        movie.director = ''
        movie.rating = MovieRating.R
        movie.imageIds = []

        return movie.save()
    }

    async updateMovie(movieId: string, updateDto: UpdateMovieDraftDto) {
        const movie = await this.getById(movieId)

        if (updateDto.title) movie.title = updateDto.title
        if (updateDto.genres) movie.genres = updateDto.genres
        if (updateDto.releaseDate) movie.releaseDate = updateDto.releaseDate
        if (updateDto.plot) movie.plot = updateDto.plot
        if (updateDto.durationInSeconds) movie.durationInSeconds = updateDto.durationInSeconds
        if (updateDto.director) movie.director = updateDto.director
        if (updateDto.rating) movie.rating = updateDto.rating

        return movie.save()
    }
}

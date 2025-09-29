import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { DateUtil, MongooseRepository } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule, Rules } from 'shared'
import { UpdateMovieDto } from './dtos'
import { MovieDraft } from './models'

export class UpdateMovieDraftDto extends UpdateMovieDto {}

@Injectable()
export class MovieDraftsRepository extends MongooseRepository<MovieDraft> {
    constructor(
        @InjectModel(MovieDraft.name, MongooseConfigModule.connectionName) model: Model<MovieDraft>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async createMovieDraft() {
        const movie = this.newDocument()
        movie.expiresAt = DateUtil.add({ minutes: Rules.Movie.draftExpiresInMinutes })

        return movie.save()
    }

    async updateMovie(movieId: string, updateDto: UpdateMovieDraftDto) {
        const movie = await this.getById(movieId)

        movie.set(updateDto)

        return movie.save()
    }
}

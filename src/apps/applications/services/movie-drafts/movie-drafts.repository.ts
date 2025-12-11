import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseRepository } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { MovieDraft, MovieDraftDocument, MovieDraftImage } from './models/movie-draft'

@Injectable()
export class MovieDraftsRepository extends MongooseRepository<MovieDraft> {
    constructor(
        @InjectModel(MovieDraft.name, MongooseConfigModule.connectionName)
        readonly model: Model<MovieDraft>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async createDraft(values: Partial<MovieDraft>) {
        const draft = this.newDocument()
        draft.expiresAt = values.expiresAt as Date
        draft.title = values.title
        draft.genres = values.genres ?? []
        draft.releaseDate = values.releaseDate
        draft.plot = values.plot
        draft.durationInSeconds = values.durationInSeconds
        draft.director = values.director
        draft.rating = values.rating
        draft.images = values.images ?? []

        return draft.save()
    }

    async addOrUpdateImage(draftId: string, image: MovieDraftImage): Promise<MovieDraftDocument> {
        const draft = await this.getById(draftId)
        const existing = draft.images.find((img) => img.assetId === image.assetId)

        if (existing) {
            existing.status = image.status
        } else {
            draft.images.push(image)
        }

        await draft.save()
        return draft
    }
}

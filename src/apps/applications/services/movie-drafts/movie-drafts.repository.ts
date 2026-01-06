import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { assignDefined, MongooseRepository } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { UpdateMovieDraftDto } from './dtos'
import { MovieAssetDraft, MovieDraft, MovieDraftDocument } from './models'

@Injectable()
export class MovieDraftsRepository extends MongooseRepository<MovieDraft> {
    constructor(
        @InjectModel(MovieDraft.name, MongooseConfigModule.connectionName)
        readonly model: Model<MovieDraft>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async createDraft() {
        const draft = this.newDocument()
        return draft.save()
    }

    async update(draftId: string, updateDto: UpdateMovieDraftDto) {
        const draft = await this.getById(draftId)

        assignDefined(draft, updateDto, 'title')
        assignDefined(draft, updateDto, 'genres')
        assignDefined(draft, updateDto, 'releaseDate')
        assignDefined(draft, updateDto, 'plot')
        assignDefined(draft, updateDto, 'durationInSeconds')
        assignDefined(draft, updateDto, 'director')
        assignDefined(draft, updateDto, 'rating')

        return draft.save()
    }

    async addOrUpdateImage(draftId: string, image: MovieAssetDraft): Promise<MovieDraftDocument> {
        const draft = await this.getById(draftId)
        const existing = draft.assets.find((img) => img.assetId === image.assetId)

        if (existing) {
            existing.status = image.status
        } else {
            draft.assets.push(image)
        }

        return draft.save()
    }
}

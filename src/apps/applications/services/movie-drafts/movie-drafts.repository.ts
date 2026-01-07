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

    async createMovieDraft() {
        const draft = this.newDocument()
        return draft.save()
    }

    async update(movieId: string, updateDto: UpdateMovieDraftDto) {
        const draft = await this.getById(movieId)

        assignDefined(draft, updateDto, 'title')
        assignDefined(draft, updateDto, 'genres')
        assignDefined(draft, updateDto, 'releaseDate')
        assignDefined(draft, updateDto, 'plot')
        assignDefined(draft, updateDto, 'durationInSeconds')
        assignDefined(draft, updateDto, 'director')
        assignDefined(draft, updateDto, 'rating')

        return draft.save()
    }

    async addOrUpdateAsset(movieId: string, asset: MovieAssetDraft): Promise<MovieDraftDocument> {
        const draft = await this.getById(movieId)
        const existing = draft.assets.find((img) => img.assetId === asset.assetId)

        if (existing) {
            existing.status = asset.status
        } else {
            draft.assets.push(asset)
        }

        return draft.save()
    }
}

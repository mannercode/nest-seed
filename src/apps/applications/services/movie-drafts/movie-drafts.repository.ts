import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { assignDefined, MongooseRepository } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { UpdateMovieDraftDto } from './dtos'
import { MovieDraftAsset, MovieDraft, MovieDraftAssetStatus, MovieDraftDocument } from './models'

@Injectable()
export class MovieDraftsRepository extends MongooseRepository<MovieDraft> {
    constructor(
        @InjectModel(MovieDraft.name, MongooseConfigModule.connectionName)
        readonly model: Model<MovieDraft>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async create() {
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

    async addAsset(draftId: string, asset: MovieDraftAsset): Promise<MovieDraftDocument> {
        const draft = await this.getById(draftId)
        const existing = draft.assets.find((draftAsset) => draftAsset.assetId === asset.assetId)

        if (!existing) {
            draft.assets.push(asset)
            return draft.save()
        }

        return draft
    }

    async updateAsset(
        draft: MovieDraftDocument,
        assetId: string,
        status: MovieDraftAssetStatus
    ): Promise<MovieDraftDocument> {
        const existing = draft.assets.find((draftAsset) => draftAsset.assetId === assetId)

        if (!existing) {
            return draft
        }

        existing.status = status
        return draft.save()
    }

    async removeAsset(draftId: string, assetId: string): Promise<boolean> {
        const draft = await this.findById(draftId)

        if (!draft) {
            return false
        }

        const nextAssets = draft.assets.filter((asset) => asset.assetId !== assetId)
        if (nextAssets.length === draft.assets.length) {
            return false
        }

        draft.assets = nextAssets
        await draft.save()

        return true
    }
}

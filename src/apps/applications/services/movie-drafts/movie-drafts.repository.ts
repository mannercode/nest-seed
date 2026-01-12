import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { assignDefined, MongooseRepository } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { UpdateMovieDraftDto } from './dtos'
import { MovieDraftErrors } from './errors'
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

    async addAsset(draftId: string, asset: MovieDraftAsset) {
        const draft = await this.getById(draftId)
        draft.assets.push(asset)

        await draft.save()
    }

    async updateAsset(
        draftId: string,
        assetId: string,
        status: MovieDraftAssetStatus
    ): Promise<MovieDraftDocument> {
        const draft = await this.getById(draftId)
        const asset = draft.assets.find((draftAsset) => draftAsset.assetId === assetId)

        if (!asset) {
            throw new NotFoundException({ ...MovieDraftErrors.AssetNotFound, assetId })
        }

        asset.status = status
        return draft.save()
    }

    async removeAsset(draftId: string, assetId: string): Promise<boolean> {
        const draft = await this.getById(draftId)

        const nextAssets = draft.assets.filter((asset) => asset.assetId !== assetId)

        if (nextAssets.length === draft.assets.length) {
            return false
        }

        draft.assets = nextAssets
        await draft.save()

        return true
    }
}

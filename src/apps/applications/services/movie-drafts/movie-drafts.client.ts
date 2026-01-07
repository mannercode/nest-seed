import { Injectable } from '@nestjs/common'
import { AssetPresignedUploadDto, CreateAssetDto } from 'apps/infrastructures'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { MovieDraftAssetDto, MovieDraftDto, UpdateMovieDraftDto } from './dtos'
import type { MovieDto } from 'apps/cores'

@Injectable()
export class MovieDraftsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    createMovieDraft(): Promise<MovieDraftDto> {
        return this.proxy.request(Messages.MovieDrafts.create)
    }

    getMovieDraft(draftId: string): Promise<MovieDraftDto> {
        return this.proxy.request(Messages.MovieDrafts.get, draftId)
    }

    updateMovieDraft(draftId: string, updateDto: UpdateMovieDraftDto): Promise<MovieDraftDto> {
        return this.proxy.request(Messages.MovieDrafts.update, { draftId, updateDto })
    }

    deleteMovieDraft(draftId: string): Promise<Record<string, never>> {
        return this.proxy.request(Messages.MovieDrafts.delete, draftId)
    }

    completeMovieDraft(draftId: string): Promise<MovieDto> {
        return this.proxy.request(Messages.MovieDrafts.complete, draftId)
    }

    createAsset(draftId: string, createDto: CreateAssetDto): Promise<AssetPresignedUploadDto> {
        return this.proxy.request(Messages.MovieDrafts.Assets.create, { draftId, createDto })
    }

    deleteAsset(draftId: string, assetId: string): Promise<Record<string, never>> {
        return this.proxy.request(Messages.MovieDrafts.Assets.delete, { draftId, assetId })
    }

    completeAsset(draftId: string, assetId: string): Promise<MovieDraftAssetDto> {
        return this.proxy.request(Messages.MovieDrafts.Assets.complete, { draftId, assetId })
    }
}

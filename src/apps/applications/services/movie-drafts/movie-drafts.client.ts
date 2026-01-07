import { Injectable } from '@nestjs/common'
import { AssetPresignedUploadDto, CreateAssetDto } from 'apps/infrastructures'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { MovieDraftAssetDto, MovieDraftDto, UpdateMovieDraftDto } from './dtos'

@Injectable()
export class MovieDraftsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    createMovieDraft(): Promise<MovieDraftDto> {
        return this.proxy.request(Messages.MovieDrafts.create)
    }

    getMovieDraft(movieId: string): Promise<MovieDraftDto> {
        return this.proxy.request(Messages.MovieDrafts.get, movieId)
    }

    updateMovieDraft(movieId: string, updateDto: UpdateMovieDraftDto): Promise<MovieDraftDto> {
        return this.proxy.request(Messages.MovieDrafts.update, { movieId, updateDto })
    }

    deleteMovieDraft(movieId: string): Promise<boolean> {
        return this.proxy.request(Messages.MovieDrafts.delete, movieId)
    }

    completeMovieDraft(movieId: string) {
        return this.proxy.request(Messages.MovieDrafts.complete, movieId)
    }

    createAssetDraft(movieId: string, createDto: CreateAssetDto): Promise<AssetPresignedUploadDto> {
        return this.proxy.request(Messages.MovieDrafts.Assets.create, { movieId, createDto })
    }

    deleteAssetDraft(movieId: string, assetId: string): Promise<boolean> {
        return this.proxy.request(Messages.MovieDrafts.Assets.delete, { movieId, assetId })
    }

    completeAssetDraft(movieId: string, assetId: string): Promise<MovieDraftAssetDto> {
        return this.proxy.request(Messages.MovieDrafts.Assets.complete, { movieId, assetId })
    }
}

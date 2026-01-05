import { Injectable } from '@nestjs/common'
import { AssetPresignedUploadDto, CreateAssetDto } from 'apps/infrastructures'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { MovieDraftDto, MovieDraftImageDto, UpdateMovieDraftDto } from './dtos'

@Injectable()
export class MovieDraftsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(): Promise<MovieDraftDto> {
        return this.proxy.request(Messages.MovieDrafts.create)
    }

    get(draftId: string): Promise<MovieDraftDto> {
        return this.proxy.request(Messages.MovieDrafts.get, draftId)
    }

    update(draftId: string, updateDto: UpdateMovieDraftDto): Promise<MovieDraftDto> {
        return this.proxy.request(Messages.MovieDrafts.update, { draftId, updateDto })
    }

    delete(draftId: string): Promise<boolean> {
        return this.proxy.request(Messages.MovieDrafts.delete, draftId)
    }

    requestImageUpload(
        draftId: string,
        createDto: CreateAssetDto
    ): Promise<AssetPresignedUploadDto> {
        return this.proxy.request(Messages.MovieDrafts.Images.create, { draftId, createDto })
    }

    deleteImage(draftId: string, imageId: string): Promise<boolean> {
        return this.proxy.request(Messages.MovieDrafts.Images.delete, { draftId, imageId })
    }

    completeImage(draftId: string, imageId: string): Promise<MovieDraftImageDto> {
        return this.proxy.request(Messages.MovieDrafts.Images.complete, { draftId, imageId })
    }

    completeDraft(draftId: string) {
        return this.proxy.request(Messages.MovieDrafts.complete, draftId)
    }
}

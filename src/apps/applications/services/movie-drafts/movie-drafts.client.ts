import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreateAssetDto } from 'apps/infrastructures'
import { DraftImageDto, DraftImageUploadResponse, MovieDraftDto, UpdateMovieDraftDto } from './dtos'

@Injectable()
export class MovieDraftsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(): Promise<MovieDraftDto> {
        return this.proxy.getJson(Messages.MovieDrafts.create)
    }

    get(draftId: string): Promise<MovieDraftDto> {
        return this.proxy.getJson(Messages.MovieDrafts.get, draftId)
    }

    update(draftId: string, updateDto: UpdateMovieDraftDto): Promise<MovieDraftDto> {
        return this.proxy.getJson(Messages.MovieDrafts.update, { draftId, updateDto })
    }

    delete(draftId: string): Promise<boolean> {
        return this.proxy.getJson(Messages.MovieDrafts.delete, draftId)
    }

    requestImageUpload(
        draftId: string,
        createDto: CreateAssetDto
    ): Promise<DraftImageUploadResponse> {
        return this.proxy.getJson(Messages.MovieDrafts.createImage, { draftId, createDto })
    }

    completeImage(draftId: string, imageId: string): Promise<DraftImageDto> {
        return this.proxy.getJson(Messages.MovieDrafts.completeImage, { draftId, imageId })
    }

    completeDraft(draftId: string) {
        return this.proxy.getJson(Messages.MovieDrafts.complete, draftId)
    }
}

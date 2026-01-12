import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { CreateAssetDto } from 'apps/infrastructures'
import { Messages } from 'shared'
import { UpdateMovieDraftDto } from './dtos'
import { MovieDraftsService } from './movie-drafts.service'

@Controller()
export class MovieDraftsController {
    constructor(private readonly service: MovieDraftsService) {}

    @MessagePattern(Messages.MovieDrafts.create)
    createMovieDraft() {
        return this.service.createMovieDraft()
    }

    @MessagePattern(Messages.MovieDrafts.get)
    getMovieDraft(@Payload() draftId: string) {
        return this.service.getMovieDraft(draftId)
    }

    @MessagePattern(Messages.MovieDrafts.update)
    updateMovieDraft(
        @Payload('draftId') draftId: string,
        @Payload('updateDto') updateDto: UpdateMovieDraftDto
    ) {
        return this.service.updateMovieDraft(draftId, updateDto)
    }

    @MessagePattern(Messages.MovieDrafts.delete)
    deleteMovieDraft(@Payload() draftId: string) {
        return this.service.deleteMovieDraft(draftId)
    }

    @MessagePattern(Messages.MovieDrafts.complete)
    completeMovieDraft(@Payload() draftId: string) {
        return this.service.completeMovieDraft(draftId)
    }

    @MessagePattern(Messages.MovieDrafts.Assets.create)
    createAsset(
        @Payload('draftId') draftId: string,
        @Payload('createDto') createDto: CreateAssetDto
    ) {
        return this.service.createAsset(draftId, createDto)
    }

    @MessagePattern(Messages.MovieDrafts.Assets.delete)
    deleteAsset(@Payload('draftId') draftId: string, @Payload('assetId') assetId: string) {
        return this.service.deleteAsset(draftId, assetId)
    }

    @MessagePattern(Messages.MovieDrafts.Assets.complete)
    completeAsset(@Payload('draftId') draftId: string, @Payload('assetId') assetId: string) {
        return this.service.completeAsset(draftId, assetId)
    }
}

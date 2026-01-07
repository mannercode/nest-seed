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
    getMovieDraft(@Payload() movieId: string) {
        return this.service.getMovieDraft(movieId)
    }

    @MessagePattern(Messages.MovieDrafts.update)
    updateMovieDraft(
        @Payload('movieId') movieId: string,
        @Payload('updateDto') updateDto: UpdateMovieDraftDto
    ) {
        return this.service.updateMovieDraft(movieId, updateDto)
    }

    @MessagePattern(Messages.MovieDrafts.delete)
    deleteMovieDraft(@Payload() movieId: string) {
        return this.service.deleteMovieDraft(movieId)
    }

    @MessagePattern(Messages.MovieDrafts.complete)
    completeMovieDraft(@Payload() movieId: string) {
        return this.service.completeMovieDraft(movieId)
    }

    @MessagePattern(Messages.MovieDrafts.Assets.create)
    createAssetDraft(
        @Payload('movieId') movieId: string,
        @Payload('createDto') createDto: CreateAssetDto
    ) {
        return this.service.createAssetDraft(movieId, createDto)
    }

    @MessagePattern(Messages.MovieDrafts.Assets.delete)
    deleteAssetDraft(@Payload('movieId') movieId: string, @Payload('assetId') assetId: string) {
        return this.service.deleteAssetDraft(movieId, assetId)
    }

    @MessagePattern(Messages.MovieDrafts.Assets.complete)
    completeAssetDraft(@Payload('movieId') movieId: string, @Payload('assetId') assetId: string) {
        return this.service.completeAssetDraft(movieId, assetId)
    }
}

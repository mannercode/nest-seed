import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { CreateAssetDto } from 'apps/infrastructures'
import { Messages } from 'shared'
import { CreateMovieDraftDto, UpdateMovieDraftDto } from './dtos'
import { MovieDraftsService } from './movie-drafts.service'

@Controller()
export class MovieDraftsController {
    constructor(private readonly service: MovieDraftsService) {}

    @MessagePattern(Messages.MovieDrafts.create)
    create(@Payload() createDto: CreateMovieDraftDto) {
        return this.service.create(createDto)
    }

    @MessagePattern(Messages.MovieDrafts.get)
    get(@Payload() draftId: string) {
        return this.service.get(draftId)
    }

    @MessagePattern(Messages.MovieDrafts.update)
    update(
        @Payload('draftId') draftId: string,
        @Payload('updateDto') updateDto: UpdateMovieDraftDto
    ) {
        return this.service.update(draftId, updateDto)
    }

    @MessagePattern(Messages.MovieDrafts.delete)
    delete(@Payload() draftId: string) {
        return this.service.delete(draftId)
    }

    @MessagePattern(Messages.MovieDrafts.createImage)
    requestImageUpload(
        @Payload('draftId') draftId: string,
        @Payload('createDto') createDto: CreateAssetDto
    ) {
        return this.service.requestImageUpload(draftId, createDto)
    }

    @MessagePattern(Messages.MovieDrafts.completeImage)
    completeImage(@Payload('draftId') draftId: string, @Payload('imageId') imageId: string) {
        return this.service.completeImage(draftId, imageId)
    }

    @MessagePattern(Messages.MovieDrafts.complete)
    completeDraft(@Payload() draftId: string) {
        return this.service.completeDraft(draftId)
    }
}

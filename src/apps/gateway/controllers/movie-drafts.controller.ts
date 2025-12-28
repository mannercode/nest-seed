import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post
} from '@nestjs/common'
import { MovieDraftsClient, UpdateMovieDraftDto } from 'apps/applications'
import { CreateAssetDto } from 'apps/infrastructures'

@Controller('movie-drafts')
export class MovieDraftsController {
    constructor(private readonly movieDraftsClient: MovieDraftsClient) {}

    @Post()
    create() {
        return this.movieDraftsClient.create()
    }

    @Get(':draftId')
    get(@Param('draftId') draftId: string) {
        return this.movieDraftsClient.get(draftId)
    }

    @Patch(':draftId')
    update(@Param('draftId') draftId: string, @Body() updateDto: UpdateMovieDraftDto) {
        return this.movieDraftsClient.update(draftId, updateDto)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':draftId')
    async delete(@Param('draftId') draftId: string) {
        await this.movieDraftsClient.delete(draftId)
    }

    @Post(':draftId/complete')
    complete(@Param('draftId') draftId: string) {
        return this.movieDraftsClient.completeDraft(draftId)
    }

    @Post(':draftId/images')
    requestImageUpload(@Param('draftId') draftId: string, @Body() createDto: CreateAssetDto) {
        return this.movieDraftsClient.requestImageUpload(draftId, createDto)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':draftId/images/:imageId')
    async deleteImage(@Param('draftId') draftId: string, @Param('imageId') imageId: string) {
        await this.movieDraftsClient.deleteImage(draftId, imageId)
    }

    @HttpCode(HttpStatus.OK)
    @Post(':draftId/images/:imageId/complete')
    completeImage(@Param('draftId') draftId: string, @Param('imageId') imageId: string) {
        return this.movieDraftsClient.completeImage(draftId, imageId)
    }
}

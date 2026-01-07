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
        return this.movieDraftsClient.createMovieDraft()
    }

    @Get(':draftId')
    get(@Param('draftId') draftId: string) {
        return this.movieDraftsClient.getMovieDraft(draftId)
    }

    @Patch(':draftId')
    update(@Param('draftId') draftId: string, @Body() updateDto: UpdateMovieDraftDto) {
        return this.movieDraftsClient.updateMovieDraft(draftId, updateDto)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':draftId')
    async delete(@Param('draftId') draftId: string) {
        await this.movieDraftsClient.deleteMovieDraft(draftId)
    }

    @Post(':draftId/complete')
    complete(@Param('draftId') draftId: string) {
        return this.movieDraftsClient.completeMovieDraft(draftId)
    }

    @Post(':draftId/assets')
    createAsset(@Param('draftId') draftId: string, @Body() createDto: CreateAssetDto) {
        return this.movieDraftsClient.createAsset(draftId, createDto)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':draftId/assets/:assetId')
    async deleteAsset(@Param('draftId') draftId: string, @Param('assetId') assetId: string) {
        await this.movieDraftsClient.deleteAsset(draftId, assetId)
    }

    @HttpCode(HttpStatus.OK)
    @Post(':draftId/assets/:assetId/complete')
    completeAsset(@Param('draftId') draftId: string, @Param('assetId') assetId: string) {
        return this.movieDraftsClient.completeAsset(draftId, assetId)
    }
}

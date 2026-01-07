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

    @Get(':movieId')
    get(@Param('movieId') movieId: string) {
        return this.movieDraftsClient.getMovieDraft(movieId)
    }

    @Patch(':movieId')
    update(@Param('movieId') movieId: string, @Body() updateDto: UpdateMovieDraftDto) {
        return this.movieDraftsClient.updateMovieDraft(movieId, updateDto)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':movieId')
    async delete(@Param('movieId') movieId: string) {
        await this.movieDraftsClient.deleteMovieDraft(movieId)
    }

    @Post(':movieId/complete')
    complete(@Param('movieId') movieId: string) {
        return this.movieDraftsClient.completeMovieDraft(movieId)
    }

    @Post(':movieId/assets')
    createAssetDraft(@Param('movieId') movieId: string, @Body() createDto: CreateAssetDto) {
        return this.movieDraftsClient.createAssetDraft(movieId, createDto)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':movieId/assets/:assetId')
    async deleteAsset(@Param('movieId') movieId: string, @Param('assetId') assetId: string) {
        await this.movieDraftsClient.deleteAssetDraft(movieId, assetId)
    }

    @HttpCode(HttpStatus.OK)
    @Post(':movieId/assets/:assetId/complete')
    completeAsset(@Param('movieId') movieId: string, @Param('assetId') assetId: string) {
        return this.movieDraftsClient.completeAssetDraft(movieId, assetId)
    }
}

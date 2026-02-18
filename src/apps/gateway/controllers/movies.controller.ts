import type { RecommendationClient } from 'apps/applications'
import type { MoviesClient, SearchMoviesPageDto, UpsertMovieDto } from 'apps/cores'
import type { CreateAssetDto } from 'apps/infrastructures'
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards
} from '@nestjs/common'
import { defaultTo } from 'lodash'
import type { CustomerOptionalAuthRequest } from './types'
import { CustomerOptionalJwtAuthGuard } from './guards'

@Controller('movies')
export class MoviesController {
    constructor(
        private readonly moviesClient: MoviesClient,
        private readonly recommendationClient: RecommendationClient
    ) {}

    @Post()
    async create(@Body() upsertDto: UpsertMovieDto) {
        return this.moviesClient.create(upsertDto)
    }

    @Post(':movieId/assets')
    createAsset(@Param('movieId') movieId: string, @Body() createDto: CreateAssetDto) {
        return this.moviesClient.createAsset(movieId, createDto)
    }

    @Delete(':movieId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('movieId') movieId: string) {
        await this.moviesClient.deleteMany([movieId])
    }

    @Delete(':movieId/assets/:assetId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteAsset(@Param('movieId') movieId: string, @Param('assetId') assetId: string) {
        await this.moviesClient.deleteAsset(movieId, assetId)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post(':movieId/assets/:assetId/finalize')
    async finalizeUpload(@Param('movieId') movieId: string, @Param('assetId') assetId: string) {
        await this.moviesClient.finalizeUpload(movieId, assetId)
    }

    @Get(':movieId')
    async get(@Param('movieId') movieId: string) {
        const [movie] = await this.moviesClient.getMany([movieId])
        return movie
    }

    @HttpCode(HttpStatus.OK)
    @Post(':movieId/publish')
    publish(@Param('movieId') movieId: string) {
        return this.moviesClient.publish(movieId)
    }

    @Get()
    async searchPage(@Query() searchDto: SearchMoviesPageDto) {
        return this.moviesClient.searchPage(searchDto)
    }

    @Get('recommended')
    @UseGuards(CustomerOptionalJwtAuthGuard)
    async searchRecommendedMovies(@Req() req: CustomerOptionalAuthRequest) {
        const customerId = defaultTo(req.user?.customerId, null)

        return this.recommendationClient.searchRecommendedMovies(customerId)
    }

    @Patch(':movieId')
    async update(@Param('movieId') movieId: string, @Body() updateDto: UpsertMovieDto) {
        return this.moviesClient.update(movieId, updateDto)
    }
}

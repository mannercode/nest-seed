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
import { RecommendationService } from 'applications'
import { MoviesService, SearchMoviesPageDto, UpsertMovieDto } from 'cores'
import { CreateAssetDto } from 'infrastructures'
import { defaultTo } from 'lodash'
import { CustomerOptionalJwtAuthGuard } from './guards'
import { CustomerOptionalAuthRequest } from './types'

@Controller('movies')
export class MoviesHttpController {
    constructor(
        private readonly moviesService: MoviesService,
        private readonly recommendationService: RecommendationService
    ) {}

    @Post()
    async create(@Body() upsertDto: UpsertMovieDto) {
        return this.moviesService.create(upsertDto)
    }

    @Post(':movieId/assets')
    createAsset(@Param('movieId') movieId: string, @Body() createDto: CreateAssetDto) {
        return this.moviesService.createAsset(movieId, createDto)
    }

    @Delete(':movieId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('movieId') movieId: string) {
        await this.moviesService.deleteMany([movieId])
    }

    @Delete(':movieId/assets/:assetId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteAsset(@Param('movieId') movieId: string, @Param('assetId') assetId: string) {
        await this.moviesService.deleteAsset(movieId, assetId)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post(':movieId/assets/:assetId/finalize')
    async finalizeUpload(@Param('movieId') movieId: string, @Param('assetId') assetId: string) {
        await this.moviesService.finalizeUpload(movieId, assetId)
    }

    @Get('recommended')
    @UseGuards(CustomerOptionalJwtAuthGuard)
    async searchRecommendedMovies(@Req() req: CustomerOptionalAuthRequest) {
        const customerId = defaultTo(req.user?.customerId, null)

        return this.recommendationService.searchRecommendedMovies(customerId)
    }

    @Get(':movieId')
    async get(@Param('movieId') movieId: string) {
        const [movie] = await this.moviesService.getMany([movieId])
        return movie
    }

    @HttpCode(HttpStatus.OK)
    @Post(':movieId/publish')
    publish(@Param('movieId') movieId: string) {
        return this.moviesService.publish(movieId)
    }

    @Get()
    async searchPage(@Query() searchDto: SearchMoviesPageDto) {
        return this.moviesService.searchPage(searchDto)
    }

    @Patch(':movieId')
    async update(@Param('movieId') movieId: string, @Body() upsertDto: UpsertMovieDto) {
        return this.moviesService.update(movieId, upsertDto)
    }
}

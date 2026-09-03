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
    UseGuards
} from '@nestjs/common'
import { CatalogManagementService } from '#application'
import {
    MoviesService,
    SearchMoviesPageSchema,
    type SearchMoviesPageDto,
    type UpsertMovieDto,
    UpsertMovieSchema
} from '#core'
import { CreateAssetSchema, type CreateAssetDto } from '#infrastructure'
import { AdminAuthGuard } from './guards/index.js'

@Controller('movies')
export class MoviesHttpController {
    constructor(
        private readonly moviesService: MoviesService,
        private readonly catalogManagementService: CatalogManagementService
    ) {}

    @Post()
    @UseGuards(AdminAuthGuard)
    async create(@Body({ schema: UpsertMovieSchema }) upsertDto: UpsertMovieDto) {
        return this.moviesService.create(upsertDto)
    }

    @Post(':movieId/assets')
    @UseGuards(AdminAuthGuard)
    createAsset(
        @Param('movieId') movieId: string,
        @Body({ schema: CreateAssetSchema }) createDto: CreateAssetDto
    ) {
        return this.moviesService.createAsset(movieId, createDto)
    }

    @Delete(':movieId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AdminAuthGuard)
    async delete(@Param('movieId') movieId: string) {
        await this.catalogManagementService.deleteMovie(movieId)
    }

    @Delete(':movieId/assets/:assetId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AdminAuthGuard)
    async deleteAsset(@Param('movieId') movieId: string, @Param('assetId') assetId: string) {
        await this.moviesService.deleteAsset(movieId, assetId)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post(':movieId/assets/:assetId/finalize')
    @UseGuards(AdminAuthGuard)
    async finalizeUpload(@Param('movieId') movieId: string, @Param('assetId') assetId: string) {
        await this.moviesService.finalizeUpload(movieId, assetId)
    }

    @Get(':movieId')
    async get(@Param('movieId') movieId: string) {
        // 공개 라우트이므로 미공개(draft) 영화는 404로 숨긴다.
        return this.moviesService.getPublished(movieId)
    }

    @HttpCode(HttpStatus.OK)
    @Post(':movieId/publish')
    @UseGuards(AdminAuthGuard)
    publish(@Param('movieId') movieId: string) {
        return this.moviesService.publish(movieId)
    }

    @Get()
    async searchPage(@Query({ schema: SearchMoviesPageSchema }) searchDto: SearchMoviesPageDto) {
        return this.moviesService.searchPage(searchDto)
    }

    @Patch(':movieId')
    @UseGuards(AdminAuthGuard)
    async update(
        @Param('movieId') movieId: string,
        @Body({ schema: UpsertMovieSchema }) upsertDto: UpsertMovieDto
    ) {
        return this.moviesService.update(movieId, upsertDto)
    }
}

import { defaultTo } from '@mannercode/common'
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
import { RecommendationService } from 'application'
import { MoviesService, SearchMoviesPageDto, UpsertMovieDto } from 'core'
import { CreateAssetDto } from 'infrastructure'
import { UserOptionalJwtAuthGuard } from './guards'
import { UserOptionalAuthRequest } from './types'

// AUTHZ: 시드는 인가 검사를 일부러 비워 둔다. 포크 시 도메인 정책에 맞춰
// `@UseGuards(UserJwtAuthGuard)` 등의 가드와 admin/owner 검사를 추가하라.
// README "5. 인가" 섹션 참고.
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
    @UseGuards(UserOptionalJwtAuthGuard)
    async searchRecommendedMovies(@Req() req: UserOptionalAuthRequest) {
        const userId = defaultTo(req.user?.sub, null)

        return this.recommendationService.searchRecommendedMovies(userId)
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

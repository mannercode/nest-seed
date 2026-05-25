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
import { AdminAuthGuard, OptionalAuth, UserAuthGuard } from './guards'
import { UserOptionalAuthRequest } from './types'

// 인가: 변경 핸들러(create/update/delete/asset 관리/publish)는 admin 전용, 조회는 공개로 둔다.
// 추천은 게스트도 호출하되 로그인 시 개인화하므로 optional 사용자 가드를 단다.
@Controller('movies')
export class MoviesHttpController {
    constructor(
        private readonly moviesService: MoviesService,
        private readonly recommendationService: RecommendationService
    ) {}

    @Post()
    @UseGuards(AdminAuthGuard)
    async create(@Body() upsertDto: UpsertMovieDto) {
        return this.moviesService.create(upsertDto)
    }

    @Post(':movieId/assets')
    @UseGuards(AdminAuthGuard)
    createAsset(@Param('movieId') movieId: string, @Body() createDto: CreateAssetDto) {
        return this.moviesService.createAsset(movieId, createDto)
    }

    @Delete(':movieId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AdminAuthGuard)
    async delete(@Param('movieId') movieId: string) {
        await this.moviesService.deleteMany([movieId])
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

    @Get('recommended')
    @OptionalAuth()
    @UseGuards(UserAuthGuard)
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
    @UseGuards(AdminAuthGuard)
    publish(@Param('movieId') movieId: string) {
        return this.moviesService.publish(movieId)
    }

    @Get()
    async searchPage(@Query() searchDto: SearchMoviesPageDto) {
        return this.moviesService.searchPage(searchDto)
    }

    @Patch(':movieId')
    @UseGuards(AdminAuthGuard)
    async update(@Param('movieId') movieId: string, @Body() upsertDto: UpsertMovieDto) {
        return this.moviesService.update(movieId, upsertDto)
    }
}

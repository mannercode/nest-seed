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

// 인가: 이 컨트롤러는 인가 검사를 일부러 비워 둡니다. 도메인마다 필요한 정책이
// 다르기 때문입니다. 포크해서 쓸 때는 `@UseGuards(UserJwtAuthGuard)` 같은
// 가드와 admin/owner 검사를 직접 붙입니다. 자세한 안내는 README "5. 인가"
// 절에 있습니다.
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

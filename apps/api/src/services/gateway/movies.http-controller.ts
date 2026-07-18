import {
    Body,
    ConflictException,
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
import {
    MovieErrors,
    MoviesService,
    SearchMoviesPageDto,
    ShowtimesService,
    UpsertMovieDto
} from 'core'
import { CreateAssetDto } from 'infrastructure'
import { AdminAuthGuard } from './guards'

@Controller('movies')
export class MoviesHttpController {
    constructor(
        private readonly moviesService: MoviesService,
        private readonly showtimesService: ShowtimesService
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
        // 상영이 참조하는 영화를 지우면 홈·추천 조회가 dangling 참조로 통째로 실패한다.
        // 참조가 남아 있는 동안은 삭제를 거부한다.
        if (await this.showtimesService.existsByMovieIds([movieId])) {
            throw new ConflictException(MovieErrors.DeleteBlockedByShowtimes(movieId))
        }
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
    async searchPage(@Query() searchDto: SearchMoviesPageDto) {
        return this.moviesService.searchPage(searchDto)
    }

    @Patch(':movieId')
    @UseGuards(AdminAuthGuard)
    async update(@Param('movieId') movieId: string, @Body() upsertDto: UpsertMovieDto) {
        return this.moviesService.update(movieId, upsertDto)
    }
}

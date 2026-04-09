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
    Query
} from '@nestjs/common'
import { CreateAssetDto } from 'infrastructures'
import { SearchMoviesPageDto, UpsertMovieDto } from './dtos'
import { MoviesService } from './movies.service'

@Controller('movies')
export class MoviesHttpController {
    constructor(private readonly service: MoviesService) {}

    @Post()
    async create(@Body() upsertDto: UpsertMovieDto) {
        return this.service.create(upsertDto)
    }

    @Post(':movieId/assets')
    createAsset(@Param('movieId') movieId: string, @Body() createDto: CreateAssetDto) {
        return this.service.createAsset(movieId, createDto)
    }

    @Delete(':movieId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('movieId') movieId: string) {
        await this.service.deleteMany([movieId])
    }

    @Delete(':movieId/assets/:assetId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteAsset(@Param('movieId') movieId: string, @Param('assetId') assetId: string) {
        await this.service.deleteAsset(movieId, assetId)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post(':movieId/assets/:assetId/finalize')
    async finalizeUpload(@Param('movieId') movieId: string, @Param('assetId') assetId: string) {
        await this.service.finalizeUpload(movieId, assetId)
    }

    @Get(':movieId')
    async get(@Param('movieId') movieId: string) {
        const [movie] = await this.service.getMany([movieId])
        return movie
    }

    @HttpCode(HttpStatus.OK)
    @Post(':movieId/publish')
    publish(@Param('movieId') movieId: string) {
        return this.service.publish(movieId)
    }

    @Get()
    async searchPage(@Query() searchDto: SearchMoviesPageDto) {
        return this.service.searchPage(searchDto)
    }

    @Patch(':movieId')
    async update(@Param('movieId') movieId: string, @Body() upsertDto: UpsertMovieDto) {
        return this.service.update(movieId, upsertDto)
    }
}

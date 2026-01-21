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
import { RecommendationClient } from 'apps/applications'
import { MoviesClient, SearchMoviesPageDto, UpsertMovieDto } from 'apps/cores'
import { defaultTo } from 'lodash'
import { CustomerOptionalJwtAuthGuard } from './guards'
import { CustomerOptionalAuthRequest } from './types'

@Controller('movies')
export class MoviesController {
    constructor(
        private readonly moviesClient: MoviesClient,
        private readonly recommendationClient: RecommendationClient
    ) {}

    @Post()
    async create(@Body() updateDto: UpsertMovieDto) {
        return this.moviesClient.create(updateDto)
    }

    @Post(':movieId/publish')
    publish(@Param('movieId') movieId: string) {
        return this.moviesClient.publish(movieId)
    }

    @UseGuards(CustomerOptionalJwtAuthGuard)
    @Get('recommended')
    async searchRecommendedMovies(@Req() req: CustomerOptionalAuthRequest) {
        const customerId = defaultTo(req.user?.customerId, null)

        return this.recommendationClient.searchRecommendedMovies(customerId)
    }

    @Patch(':movieId')
    async update(@Param('movieId') movieId: string, @Body() updateDto: UpsertMovieDto) {
        return this.moviesClient.update(movieId, updateDto)
    }

    @Get(':movieId')
    async get(@Param('movieId') movieId: string) {
        const movies = await this.moviesClient.getMany([movieId])
        return movies[0]
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':movieId')
    async delete(@Param('movieId') movieId: string) {
        await this.moviesClient.deleteMany([movieId])
    }

    @Get()
    async searchPage(@Query() searchDto: SearchMoviesPageDto) {
        return this.moviesClient.searchPage(searchDto)
    }
}

import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Query,
    Req,
    UseGuards
} from '@nestjs/common'
import { RecommendationClient } from 'apps/applications'
import { MoviesClient, SearchMoviesPageDto, UpdateMovieDto } from 'apps/cores'
import { Or } from 'common'
import { CustomerOptionalJwtAuthGuard } from './guards'
import { CustomerOptionalAuthRequest } from './types'

@Controller('movies')
export class MoviesController {
    constructor(
        private readonly moviesClient: MoviesClient,
        private readonly recommendationClient: RecommendationClient
    ) {}

    @UseGuards(CustomerOptionalJwtAuthGuard)
    @Get('recommended')
    async searchRecommendedMovies(@Req() req: CustomerOptionalAuthRequest) {
        const customerId = Or(req.user?.customerId, null)

        return this.recommendationClient.searchRecommendedMovies(customerId)
    }

    @Patch(':movieId')
    async update(@Param('movieId') movieId: string, @Body() updateDto: UpdateMovieDto) {
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

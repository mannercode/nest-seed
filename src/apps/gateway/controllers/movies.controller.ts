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
import { CreateMovieDto, MoviesClient, SearchMoviesPageDto, UpdateMovieDto } from 'apps/cores'
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
        const { customerId } = req.user ?? { customerId: null }

        return this.recommendationClient.searchRecommendedMovies(customerId)
    }

    // POST /v1/movies는 405 Method Not Allowed로 응답하고,
    // {
    //   "type": "https://docs.example.com/problems/use-draft",
    //   "title": "Draft required",
    //   "detail": "Create a movie by finalizing a draft.",
    //   "links": { "createDraft": "/v1/movies/drafts" }
    // }
    @Post()
    async create(@Body() createDto: CreateMovieDto) {
        return this.moviesClient.create(createDto)
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

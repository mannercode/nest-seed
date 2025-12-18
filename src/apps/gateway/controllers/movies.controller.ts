import {
    Body,
    Controller,
    Delete,
    Get,
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
        private readonly moviesService: MoviesClient,
        private readonly recommendationService: RecommendationClient
    ) {}

    @UseGuards(CustomerOptionalJwtAuthGuard)
    @Get('recommended')
    async searchRecommendedMovies(@Req() req: CustomerOptionalAuthRequest) {
        const { customerId } = req.user ?? { customerId: null }

        return this.recommendationService.searchRecommendedMovies(customerId)
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
        return this.moviesService.create(createDto)
    }

    @Patch(':movieId')
    async update(@Param('movieId') movieId: string, @Body() updateDto: UpdateMovieDto) {
        return this.moviesService.update(movieId, updateDto)
    }

    @Get(':movieId')
    async get(@Param('movieId') movieId: string) {
        const movies = await this.moviesService.getMany([movieId])
        return movies[0]
    }

    @Delete(':movieId')
    async delete(@Param('movieId') movieId: string) {
        return this.moviesService.deleteMany([movieId])
    }

    @Get()
    async searchPage(@Query() searchDto: SearchMoviesPageDto) {
        return this.moviesService.searchPage(searchDto)
    }
}

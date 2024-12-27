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
    UploadedFiles,
    UseGuards,
    UseInterceptors,
    UsePipes
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { RecommendationProxy } from 'applications'
import { AuthTokenPayload } from 'common'
import { MovieCreateDto, MovieQueryDto, MoviesProxy, MovieUpdateDto } from 'cores'
import { pick } from 'lodash'
import { CustomerOptionalJwtAuthGuard } from './guards'
import { DefaultPaginationPipe } from './pipes'

@Controller('movies')
export class MoviesController {
    constructor(
        private moviesService: MoviesProxy,
        private recommendationService: RecommendationProxy
    ) {}

    @UseInterceptors(FilesInterceptor('files'))
    @Post()
    async createMovie(
        @UploadedFiles() files: Express.Multer.File[],
        @Body() movieCreateDto: MovieCreateDto
    ) {
        const fileCreateDtos = files.map((file) =>
            pick(file, 'originalname', 'mimetype', 'size', 'path')
        )

        return this.moviesService.createMovie(movieCreateDto, fileCreateDtos)
    }

    @Patch(':movieId')
    async updateMovie(@Param('movieId') movieId: string, @Body() updateDto: MovieUpdateDto) {
        return this.moviesService.updateMovie(movieId, updateDto)
    }

    @UseGuards(CustomerOptionalJwtAuthGuard)
    @Get('recommended')
    async findRecommendedMovies(@Req() req: { user: AuthTokenPayload }) {
        const customerId = req.user.userId
        return this.recommendationService.findRecommendedMovies(customerId)
    }

    @Get(':movieId')
    async getMovie(@Param('movieId') movieId: string) {
        return this.moviesService.getMovie(movieId)
    }

    @Delete(':movieId')
    async deleteMovie(@Param('movieId') movieId: string) {
        return this.moviesService.deleteMovie(movieId)
    }

    @UsePipes(DefaultPaginationPipe)
    @Get()
    async findMovies(@Query() queryDto: MovieQueryDto) {
        return this.moviesService.findMovies(queryDto)
    }
}

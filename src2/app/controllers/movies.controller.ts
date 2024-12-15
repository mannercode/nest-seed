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
import { AuthTokenPayload } from 'common'
import { pick } from 'lodash'
import { RecommendationService } from 'services/applications'
import { MovieCreateDto, MovieQueryDto, MoviesService, MovieUpdateDto } from 'services/cores'
import { CustomerOptionalJwtAuthGuard } from './guards'
import { DefaultPaginationPipe } from './pipes'

@Controller('movies')
export class MoviesController {
    constructor(
        private service: MoviesService,
        private recommendationService: RecommendationService
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

        return this.service.createMovie(movieCreateDto, fileCreateDtos)
    }

    @Patch(':movieId')
    async updateMovie(@Param('movieId') movieId: string, @Body() updateDto: MovieUpdateDto) {
        return this.service.updateMovie(movieId, updateDto)
    }

    @UseGuards(CustomerOptionalJwtAuthGuard)
    @Get('recommended')
    async findRecommendedMovies(@Req() req: { user: AuthTokenPayload }) {
        const customerId = req.user.userId
        return this.recommendationService.findRecommendedMovies(customerId)
    }

    @Get(':movieId')
    async getMovie(@Param('movieId') movieId: string) {
        return this.service.getMovie(movieId)
    }

    @Delete(':movieId')
    async deleteMovie(@Param('movieId') movieId: string) {
        return this.service.deleteMovie(movieId)
    }

    @UsePipes(DefaultPaginationPipe)
    @Get()
    async findMovies(@Query() queryDto: MovieQueryDto) {
        return this.service.findMovies(queryDto)
    }
}

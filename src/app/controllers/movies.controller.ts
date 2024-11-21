import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UploadedFiles,
    UseInterceptors,
    UsePipes
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { MovieCreateDto, MovieQueryDto, MoviesService, MovieUpdateDto } from 'services/movies'
import { DefaultPaginationPipe } from './pipes'
import { pick } from 'lodash'

@Controller('movies')
export class MoviesController {
    constructor(private service: MoviesService) {}

    @UseInterceptors(FilesInterceptor('files'))
    @Post()
    async createMovie(
        @UploadedFiles() files: Express.Multer.File[],
        @Body() movieCreateDto: MovieCreateDto
    ) {
        const fileCreateDtos = files.map((file) =>
            pick(file, 'originalname', 'mimetype', 'size', 'path')
        )

        return this.service.createMovie(fileCreateDtos, movieCreateDto)
    }

    @Patch(':movieId')
    async updateMovie(@Param('movieId') movieId: string, @Body() updateDto: MovieUpdateDto) {
        return this.service.updateMovie(movieId, updateDto)
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

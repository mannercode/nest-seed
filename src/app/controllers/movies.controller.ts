import {
    BadRequestException,
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
import { generateUUID, PaginationOption, PaginationPipe } from 'common'
import { Config } from 'config'
import { diskStorage } from 'multer'
import { MovieCreationDto, MoviesService, MovieQueryDto, MovieUpdateDto } from 'services/movies'

@Controller('movies')
export class MoviesController {
    constructor(private service: MoviesService) {}

    @UseInterceptors(
        FilesInterceptor('files', undefined, {
            storage: diskStorage({
                destination: (_req, _file, cb) => cb(null, Config.fileUpload.directory),
                filename: (_req, _file, cb) => cb(null, `${generateUUID()}.tmp`)
            }),
            fileFilter: (_req, file, cb) => {
                let error: Error | null = null

                if (!Config.fileUpload.allowedMimeTypes.includes(file.mimetype)) {
                    error = new BadRequestException(
                        `File type not allowed. Allowed types are: ${Config.fileUpload.allowedMimeTypes.join(', ')}`
                    )
                }

                cb(error, error === null)
            },
            limits: {
                fileSize: Config.fileUpload.maxFileSizeBytes,
                files: Config.fileUpload.maxFilesPerUpload
            }
        })
    )
    @Post()
    async createMovie(
        @UploadedFiles() files: Express.Multer.File[],
        @Body() createMovieDto: MovieCreationDto
    ) {
        const createStorageFileDtos = files.map((file) => ({
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedFilePath: file.path
        }))

        return this.service.createMovie(createStorageFileDtos, createMovieDto)
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

    @UsePipes(new PaginationPipe(Config.http.paginationDefaultSize))
    @Get()
    async findMovies(@Query() queryDto: MovieQueryDto) {
        return this.service.findMovies(queryDto)
    }
}

import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import {
    MovieCreateDto,
    MovieDto,
    MovieQueryDto,
    MovieUpdateDto,
    nullMovieDto,
    StorageFileCreateDto
} from 'types'

@Injectable()
export class MoviesService {
    constructor() {}

    @MethodLog()
    async createMovie(
        movieCreateDto: MovieCreateDto,
        fileCreateDtos: StorageFileCreateDto[]
    ): Promise<MovieDto> {
        return nullMovieDto
    }

    @MethodLog()
    async updateMovie(movieId: string, updateDto: MovieUpdateDto): Promise<MovieDto> {
        return nullMovieDto
    }

    @MethodLog({ level: 'verbose' })
    async getMovie(movieId: string): Promise<MovieDto> {
        return nullMovieDto
    }

    @MethodLog()
    async deleteMovie(movieId: string): Promise<boolean> {
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findMovies(queryDto: MovieQueryDto): Promise<MovieDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async getMoviesByIds(movieIds: string[]): Promise<MovieDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async moviesExist(movieIds: string[]): Promise<boolean> {
        return true
    }
}

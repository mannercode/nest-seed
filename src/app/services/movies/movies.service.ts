import { Injectable } from '@nestjs/common'
import { maps, MethodLog, objectId, ObjectId, objectIds, PaginationResult } from 'common'
import { StorageFileCreateDto, StorageFilesService } from '../storage-files'
import { MovieCreateDto, MovieDto, MovieQueryDto, MovieUpdateDto } from './dtos'
import { MoviesRepository } from './movies.repository'

@Injectable()
export class MoviesService {
    constructor(
        private repository: MoviesRepository,
        private storageFilesService: StorageFilesService
    ) {}

    @MethodLog()
    async createMovie(
        storageFileCreateDtos: StorageFileCreateDto[],
        movieCreateDto: MovieCreateDto
    ) {
        const storageFiles = await this.storageFilesService.saveFiles(storageFileCreateDtos)
        const storageFileIds = storageFiles.map((file) => objectId(file.id))

        const movie = await this.repository.createMovie({ ...movieCreateDto, storageFileIds })
        return new MovieDto(movie)
    }

    @MethodLog()
    async updateMovie(movieId: string, updateDto: MovieUpdateDto) {
        const movie = await this.repository.updateMovie(objectId(movieId), updateDto)
        return new MovieDto(movie)
    }

    @MethodLog({ level: 'verbose' })
    async getMovie(movieId: string) {
        const movie = await this.repository.getMovie(objectId(movieId))
        return new MovieDto(movie)
    }

    @MethodLog()
    async deleteMovie(movieId: string) {
        await this.repository.deleteMovie(objectId(movieId))
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findMovies(queryDto: MovieQueryDto) {
        const { items, ...paginated } = await this.repository.findMovies(queryDto)

        return { ...paginated, items: maps(items, MovieDto) } as PaginationResult<MovieDto>
    }

    @MethodLog({ level: 'verbose' })
    async moviesExist(movieIds: string[]): Promise<boolean> {
        return this.repository.existsByIds(objectIds(movieIds))
    }

    // @MethodLog({ level: 'verbose' })
    // async getMoviesByIds(movieIds: string[]) {
    //     const movies = await this.repository.getMoviesByIds(movieIds)
    //     return maps(movies, MovieDto)
    // }
}

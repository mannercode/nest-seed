import { Injectable } from '@nestjs/common'
import { MethodLog, pickIds, toDto } from 'common'
import { STORAGE_FILES_ROUTE } from 'config'
import { HydratedDocument } from 'mongoose'
import { StorageFileCreateDto, StorageFilesService } from '../storage-files'
import { MovieCreateDto, MovieDto, MovieQueryDto, MovieUpdateDto } from './dtos'
import { Movie } from './models'
import { MoviesRepository } from './movies.repository'

@Injectable()
export class MoviesService {
    constructor(
        private repository: MoviesRepository,
        private storageFilesService: StorageFilesService
    ) {}

    @MethodLog()
    async createMovie(movieCreateDto: MovieCreateDto, fileCreateDtos: StorageFileCreateDto[]) {
        const storageFiles = await this.storageFilesService.saveFiles(fileCreateDtos)

        const movie = await this.repository.createMovie(movieCreateDto, pickIds(storageFiles))
        return this.createMovieDto(movie)
    }

    @MethodLog()
    async updateMovie(movieId: string, updateDto: MovieUpdateDto) {
        const movie = await this.repository.updateMovie(movieId, updateDto)
        return this.createMovieDto(movie)
    }

    @MethodLog({ level: 'verbose' })
    async getMovie(movieId: string) {
        const movie = await this.repository.getById(movieId)
        return this.createMovieDto(movie)
    }

    @MethodLog()
    async deleteMovie(movieId: string) {
        await this.repository.deleteById(movieId)
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findMovies(queryDto: MovieQueryDto) {
        const { items, ...paginated } = await this.repository.findMovies(queryDto)

        return { ...paginated, items: items.map((item) => this.createMovieDto(item)) }
    }

    @MethodLog({ level: 'verbose' })
    async getMoviesByIds(movieIds: string[]) {
        const movies = await this.repository.getByIds(movieIds)

        return movies.map((movie) => this.createMovieDto(movie))
    }

    @MethodLog({ level: 'verbose' })
    async moviesExist(movieIds: string[]): Promise<boolean> {
        return this.repository.existsByIds(movieIds)
    }

    private createMovieDto(movie: HydratedDocument<Movie>) {
        const images = movie.posterFileIds.map((id) => `${STORAGE_FILES_ROUTE}/${id.toString()}`)
        return toDto(movie, MovieDto, images)
    }
}

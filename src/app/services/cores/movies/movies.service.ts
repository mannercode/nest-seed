import { Injectable } from '@nestjs/common'
import { mapDocToDto, MethodLog, pickIds } from 'common'
import { Routes } from 'config'
import { StorageFileCreateDto, StorageFilesService } from 'services/infrastructures'
import { MovieCreateDto, MovieDto, MovieQueryDto, MovieUpdateDto } from './dtos'
import { MovieDocument } from './models'
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
        return this.toDto(movie)
    }

    @MethodLog()
    async updateMovie(movieId: string, updateDto: MovieUpdateDto) {
        const movie = await this.repository.updateMovie(movieId, updateDto)
        return this.toDto(movie)
    }

    @MethodLog({ level: 'verbose' })
    async getMovie(movieId: string) {
        const movie = await this.repository.getById(movieId)
        return this.toDto(movie)
    }

    @MethodLog()
    async deleteMovie(movieId: string) {
        await this.repository.deleteById(movieId)
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findMovies(queryDto: MovieQueryDto) {
        const { items, ...paginated } = await this.repository.findMovies(queryDto)

        return { ...paginated, items: this.toDtos(items) }
    }

    @MethodLog({ level: 'verbose' })
    async getMoviesByIds(movieIds: string[]) {
        const movies = await this.repository.getByIds(movieIds)

        return this.toDtos(movies)
    }

    @MethodLog({ level: 'verbose' })
    async moviesExist(movieIds: string[]): Promise<boolean> {
        return this.repository.existByIds(movieIds)
    }

    private toDto = (movie: MovieDocument) => {
        const dto = mapDocToDto(movie, MovieDto, [
            'id',
            'title',
            'genre',
            'releaseDate',
            'plot',
            'durationMinutes',
            'director',
            'rating'
        ])
        dto.images = movie.imageFileIds.map((id) => `${Routes.StorageFiles}/${id.toString()}`)

        return dto
    }
    private toDtos = (movies: MovieDocument[]) => movies.map((movie) => this.toDto(movie))
}

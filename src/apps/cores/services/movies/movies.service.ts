import { Injectable } from '@nestjs/common'
import { CreateStorageFileDto, StorageFilesClient } from 'apps/infrastructures'
import { mapDocToDto, pickIds } from 'common'
import { HttpRoutes } from 'shared'
import { CreateMovieDto, MovieDto, SearchMoviesPageDto, UpdateMovieDto } from './dtos'
import { MovieDocument } from './models'
import { MoviesRepository } from './movies.repository'

@Injectable()
export class MoviesService {
    constructor(
        private moviesRepository: MoviesRepository,
        private storageFilesService: StorageFilesClient
    ) {}

    async create(createMovieDto: CreateMovieDto, createFileDtos: CreateStorageFileDto[]) {
        const storageFiles = await this.storageFilesService.saveFiles(createFileDtos)

        const movie = await this.moviesRepository.create(createMovieDto, pickIds(storageFiles))

        return this.toDto(movie)
    }

    async update(movieId: string, updateDto: UpdateMovieDto) {
        const movie = await this.moviesRepository.update(movieId, updateDto)

        return this.toDto(movie)
    }

    async getMany(movieIds: string[]) {
        const movies = await this.moviesRepository.getByIds(movieIds)

        return this.toDtos(movies)
    }

    async deleteMany(movieIds: string[]) {
        const movies = await this.moviesRepository.withTransaction(async (session) => {
            const movies = await this.moviesRepository.getByIds(movieIds)

            for (const movie of movies) {
                await movie.deleteOne({ session })

                const fileIds = movie.imageIds.map((id) => id.toString())
                await this.storageFilesService.deleteFiles(fileIds)
            }

            return movies
        })

        return { deletedMovies: this.toDtos(movies) }
    }

    async searchPage(searchDto: SearchMoviesPageDto) {
        const { items, ...pagination } = await this.moviesRepository.searchPage(searchDto)

        return { ...pagination, items: this.toDtos(items) }
    }

    async allExist(movieIds: string[]): Promise<boolean> {
        return this.moviesRepository.allExistByIds(movieIds)
    }

    private toDto = (movie: MovieDocument) => {
        const dto = mapDocToDto(movie, MovieDto, [
            'id',
            'title',
            'genres',
            'releaseDate',
            'plot',
            'durationInSeconds',
            'director',
            'rating'
        ])
        dto.imageUrls = movie.imageIds.map((id) => `${HttpRoutes.StorageFiles}/${id.toString()}`)

        return dto
    }
    private toDtos = (movies: MovieDocument[]) => movies.map((movie) => this.toDto(movie))
}

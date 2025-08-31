import { Injectable } from '@nestjs/common'
import { CreateStorageFileDto, StorageFilesClient } from 'apps/infrastructures'
import { DateUtil, mapDocToDto, newObjectId, pickIds } from 'common'
import { HttpRoutes } from 'shared'
import {
    CreateMovieDto,
    FinalizeMovieAssetDto,
    FinalizeMovieDraftDto,
    MovieDto,
    PresignMovieAssetDto,
    SearchMoviesPageDto,
    UpdateMovieDto
} from './dtos'
import { MovieDocument } from './models'
import { MoviesRepository } from './movies.repository'

@Injectable()
export class MoviesService {
    constructor(
        private repository: MoviesRepository,
        private storageFilesService: StorageFilesClient
    ) {}

    async presignMovieAsset(draftId: string, presignDto: PresignMovieAssetDto) {
        return { draftId, presignDto }
    }

    async finalizeMovieAsset(draftId: string, finalizeDto: FinalizeMovieAssetDto) {
        return { draftId, finalizeDto }
    }

    async finalizeMovieDraft(draftId: string, finalizeDto: FinalizeMovieDraftDto) {
        return { draftId, finalizeDto }
    }

    async createMovieDraft() {
        return { draftId: newObjectId(), expiresAt: DateUtil.add({ days: 1 }) }
    }

    async createMovie(createMovieDto: CreateMovieDto, createFileDtos: CreateStorageFileDto[]) {
        const storageFiles = await this.storageFilesService.saveFiles(createFileDtos)

        const movie = await this.repository.createMovie(createMovieDto, pickIds(storageFiles))
        return this.toDto(movie)
    }

    async updateMovie(movieId: string, updateDto: UpdateMovieDto) {
        const movie = await this.repository.updateMovie(movieId, updateDto)
        return this.toDto(movie)
    }

    async getMovies(movieIds: string[]) {
        const movies = await this.repository.getByIds(movieIds)
        return this.toDtos(movies)
    }

    async deleteMovies(movieIds: string[]) {
        const movies = await this.repository.withTransaction(async (session) => {
            const movies = await this.repository.getByIds(movieIds)

            for (const movie of movies) {
                await movie.deleteOne({ session })

                const fileIds = movie.imageIds.map((id) => id.toString())
                await this.storageFilesService.deleteFiles(fileIds)
            }

            return movies
        })

        return { deletedMovies: this.toDtos(movies) }
    }

    async searchMoviesPage(searchDto: SearchMoviesPageDto) {
        const { items, ...pagination } = await this.repository.searchMoviesPage(searchDto)

        return { ...pagination, items: this.toDtos(items) }
    }

    async moviesExist(movieIds: string[]): Promise<boolean> {
        return this.repository.existByIds(movieIds)
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

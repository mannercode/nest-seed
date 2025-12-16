import { Injectable } from '@nestjs/common'
import { AssetsClient } from 'apps/infrastructures'
import { mapDocToDto } from 'common'
import { CreateMovieDto, MovieDto, SearchMoviesPageDto, UpdateMovieDto } from './dtos'
import { MovieDocument } from './models'
import { MoviesRepository } from './movies.repository'

@Injectable()
export class MoviesService {
    constructor(
        private readonly moviesRepository: MoviesRepository,
        private readonly assetsService: AssetsClient
    ) {}

    async create(createDto: CreateMovieDto) {
        const movie = await this.moviesRepository.create(createDto)

        await Promise.all(
            createDto.assetIds.map((assetId) =>
                this.assetsService.complete(assetId, {
                    owner: { service: 'movies', entityId: movie.id }
                })
            )
        )

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

                const assetIds = movie.assetIds.map((id) => id.toString())
                await this.assetsService.deleteMany(assetIds)
            }

            return movies
        })

        movies.map((movie) => (movie.assetIds = []))

        return { deletedMovies: await this.toDtos(movies) }
    }

    async searchPage(searchDto: SearchMoviesPageDto) {
        const { items, ...pagination } = await this.moviesRepository.searchPage(searchDto)

        return { ...pagination, items: await this.toDtos(items) }
    }

    async allExist(movieIds: string[]): Promise<boolean> {
        return this.moviesRepository.allExist(movieIds)
    }

    private async toDto(movie: MovieDocument) {
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

        const assetIds = movie.assetIds.map((id) => id.toString())
        const assets = await this.assetsService.getMany(assetIds)

        dto.imageUrls = assets.map((asset) => asset.download!.url)
        return dto
    }

    private async toDtos(movies: MovieDocument[]) {
        return Promise.all(movies.map((movie) => this.toDto(movie)))
    }
}

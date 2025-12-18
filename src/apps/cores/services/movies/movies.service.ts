import { Injectable } from '@nestjs/common'
import { AssetsClient } from 'apps/infrastructures'
import { Assert, mapDocToDto, objectIds } from 'common'
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
        const movies = await this.moviesRepository.getByIds(movieIds)

        const assetIds = [
            ...new Set(movies.flatMap((movie) => movie.assetIds.map((id) => id.toString())))
        ]

        await this.assetsService.deleteMany(assetIds)

        await this.moviesRepository.model.deleteMany({ _id: { $in: objectIds(movieIds) } as any })

        movies.forEach((movie) => {
            movie.assetIds = []
        })

        return { deletedMovies: await this.toDtos(movies) }
    }

    async searchPage(searchDto: SearchMoviesPageDto) {
        const { items, ...pagination } = await this.moviesRepository.searchPage(searchDto)

        return { ...pagination, items: await this.toDtos(items) }
    }

    async allExist(movieIds: string[]): Promise<boolean> {
        return this.moviesRepository.allExist(movieIds)
    }

    private async toDto(movie: MovieDocument): Promise<MovieDto> {
        return (await this.toDtos([movie]))[0]
    }

    private async toDtos(movies: MovieDocument[]): Promise<MovieDto[]> {
        const dtos = movies.map((movie) => {
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
            dto.imageUrls = []

            return dto
        })

        const assetIds = [
            ...new Set(movies.flatMap((movie) => movie.assetIds.map((id) => id.toString())))
        ]

        if (assetIds.length === 0) {
            return dtos
        }

        const assets = await this.assetsService.getMany(assetIds)

        const assetUrlById = new Map<string, string>()

        assets.forEach((asset) => {
            Assert.defined(asset.download)

            assetUrlById.set(asset.id, asset.download.url)
        })

        movies.forEach((movie, index) => {
            const movieAssetIds = movie.assetIds.map((id) => id.toString())

            dtos[index].imageUrls = movieAssetIds.flatMap((assetId) => {
                const url = assetUrlById.get(assetId)
                Assert.defined(url)
                return [url]
            })
        })

        return dtos
    }
}

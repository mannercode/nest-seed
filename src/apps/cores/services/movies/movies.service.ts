import { Injectable } from '@nestjs/common'
import { AssetDto, AssetsClient } from 'apps/infrastructures'
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

    private toDtoBase(movie: MovieDocument): MovieDto {
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
    }

    private buildAssetUrlById(assets: AssetDto[]): Map<string, string> {
        const assetUrlById = new Map<string, string>()

        assets.forEach((asset) => {
            Assert.defined(asset.download)

            assetUrlById.set(asset.id, asset.download.url)
        })

        return assetUrlById
    }

    private async toDto(movie: MovieDocument): Promise<MovieDto> {
        const dto = this.toDtoBase(movie)

        const assetIds = movie.assetIds.map((id) => id.toString())
        if (assetIds.length === 0) {
            return dto
        }

        const resolvedAssets = await this.assetsService.getMany(assetIds)
        const assetUrlById = this.buildAssetUrlById(resolvedAssets)

        dto.imageUrls = assetIds.flatMap((assetId) => {
            const url = assetUrlById.get(assetId)
            Assert.defined(url)
            return [url]
        })

        return dto
    }
    // TODO toDtos를 기본으로 하고 toDto는 toDtos에서 하나만
    private async toDtos(movies: MovieDocument[]): Promise<MovieDto[]> {
        const dtos = movies.map((movie) => this.toDtoBase(movie))

        const assetIds = [
            ...new Set(movies.flatMap((movie) => movie.assetIds.map((id) => id.toString())))
        ]

        if (assetIds.length === 0) {
            return dtos
        }

        const assets = await this.assetsService.getMany(assetIds)
        const assetUrlById = this.buildAssetUrlById(assets)

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

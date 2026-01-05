import { Injectable } from '@nestjs/common'
import { AssetsClient } from 'apps/infrastructures'
import { Expect, mapDocToDto, pickIds } from 'common'
import { CreateMovieDto, MovieDto, SearchMoviesPageDto, UpdateMovieDto } from './dtos'
import { MovieDocument } from './models'
import { MoviesRepository } from './movies.repository'

@Injectable()
export class MoviesService {
    constructor(
        private readonly repository: MoviesRepository,
        private readonly assetsClient: AssetsClient
    ) {}

    async create(createDto: CreateMovieDto) {
        const movie = await this.repository.create(createDto)
        return this.toDto(movie)
    }

    async getMany(movieIds: string[]) {
        const movies = await this.repository.getByIds(movieIds)
        return this.toDtos(movies)
    }

    async update(movieId: string, updateDto: UpdateMovieDto) {
        const movie = await this.repository.update(movieId, updateDto)
        return this.toDto(movie)
    }

    async deleteMany(movieIds: string[]) {
        const movies = await this.repository.findByIds(movieIds)

        if (0 < movies.length) {
            const assetIdSet = new Set(
                movies.flatMap((movie) => movie.assetIds.map((id) => id.toString()))
            )

            if (0 < assetIdSet.size) {
                await this.assetsClient.deleteMany([...assetIdSet])
            }

            await this.repository.deleteByIds(pickIds(movies))
        }

        return {}
    }

    async searchPage(searchDto: SearchMoviesPageDto) {
        const { items, ...pagination } = await this.repository.searchPage(searchDto)

        return { ...pagination, items: await this.toDtos(items) }
    }

    async allExist(movieIds: string[]): Promise<boolean> {
        return this.repository.allExist(movieIds)
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

        const assetIdSet = new Set(
            movies.flatMap((movie) => movie.assetIds.map((id) => id.toString()))
        )

        if (0 < assetIdSet.size) {
            const assets = await this.assetsClient.getMany([...assetIdSet])

            const assetUrlById = new Map<string, string>()

            assets.forEach((asset) => {
                Expect.defined(asset.download)
                assetUrlById.set(asset.id, asset.download.url)
            })

            movies.forEach((movie, index) => {
                const movieAssetIds = movie.assetIds.map((id) => id.toString())

                dtos[index].imageUrls = movieAssetIds.flatMap((assetId) => {
                    const url = assetUrlById.get(assetId)
                    Expect.defined(url)
                    return [url]
                })
            })
        }

        return dtos
    }
}

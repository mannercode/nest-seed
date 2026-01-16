import { Injectable } from '@nestjs/common'
import { AssetsClient } from 'apps/infrastructures'
import { ensure, mapDocToDto, pickIds } from 'common'
import { uniq } from 'lodash'
import { CreateMovieDto, MovieDto, SearchMoviesPageDto, UpdateMovieDto } from './dtos'
import { MovieAssetsOutboxService } from './movie-assets-outbox.service'
import { Movie } from './models'
import { MoviesRepository } from './movies.repository'

@Injectable()
export class MoviesService {
    constructor(
        private readonly repository: MoviesRepository,
        private readonly assetsClient: AssetsClient,
        private readonly outboxService: MovieAssetsOutboxService
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
        const result = await this.repository.withTransaction(async (session) => {
            const movies = await this.repository.findByIds(movieIds, session)

            if (movies.length === 0) {
                return { outboxId: null }
            }

            const assetIds = uniq(movies.flatMap((movie) => movie.assetIds))
            const deleteIds = pickIds(movies)
            let outboxId: string | null = null

            if (0 < assetIds.length) {
                const outbox = await this.outboxService.enqueueDelete(
                    assetIds,
                    deleteIds,
                    session
                )
                outboxId = outbox.id
            }

            await this.repository.deleteByIds(deleteIds, session)

            return { outboxId }
        })

        if (result.outboxId) {
            await this.outboxService.dispatchNow(result.outboxId)
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

    private async toDto(movie: Movie): Promise<MovieDto> {
        return (await this.toDtos([movie]))[0]
    }

    private async toDtos(movies: Movie[]): Promise<MovieDto[]> {
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

        const assetIds = uniq(movies.flatMap((movie) => movie.assetIds))

        if (0 < assetIds.length) {
            const assets = await this.assetsClient.getMany(assetIds)

            const assetUrlById = new Map<string, string>()

            assets.forEach((asset) => {
                assetUrlById.set(asset.id, ensure(asset.download).url)
            })

            movies.forEach((movie, index) => {
                dtos[index].imageUrls = movie.assetIds.map((assetId) =>
                    ensure(assetUrlById.get(assetId))
                )
            })
        }

        return dtos
    }
}

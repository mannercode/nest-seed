import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common'
import { AssetsClient, CreateAssetDto } from 'apps/infrastructures'
import { ensure, mapDocToDto, pickIds } from 'common'
import { uniq } from 'lodash'
import { MovieDto, SearchMoviesPageDto, UpsertMovieDto } from './dtos'
import { MovieErrors } from './errors'
import { Movie } from './models'
import { MoviePendingAssetsRepository } from './movie-pending-assets.repository'
import { MoviesRepository } from './movies.repository'

@Injectable()
export class MoviesService {
    constructor(
        private readonly moviesRepository: MoviesRepository,
        private readonly assetsRepository: MoviePendingAssetsRepository,
        private readonly assetsClient: AssetsClient
    ) {}

    async create(createDto: UpsertMovieDto) {
        const movie = await this.moviesRepository.create(createDto)

        return this.toDto(movie)
    }

    async update(movieId: string, updateDto: UpsertMovieDto) {
        const movie = await this.moviesRepository.update(movieId, updateDto)
        return this.toDto(movie)
    }

    async getMany(movieIds: string[]) {
        const movies = await this.moviesRepository.getByIds(movieIds)
        return this.toDtos(movies)
    }

    async deleteMany(movieIds: string[]) {
        const movies = await this.moviesRepository.findByIds(movieIds)

        if (0 < movies.length) {
            const assetIds = uniq(movies.flatMap((movie) => movie.assetIds))

            if (0 < assetIds.length) {
                await this.assetsClient.deleteMany(assetIds)
            }

            await this.moviesRepository.deleteByIds(pickIds(movies))
        }

        return {}
    }

    async searchPage(searchDto: SearchMoviesPageDto) {
        const { items, ...pagination } = await this.moviesRepository.searchPage(searchDto)

        return { ...pagination, items: await this.toDtos(items) }
    }

    async allExist(movieIds: string[]): Promise<boolean> {
        return this.moviesRepository.allExist(movieIds)
    }

    async publish(movieId: string) {
        const movie = await this.moviesRepository.publish(movieId)
        return this.toDto(movie)
    }

    async createAsset(movieId: string, createDto: CreateAssetDto) {
        if (!createDto.mimeType.startsWith('image/')) {
            throw new BadRequestException({
                ...MovieErrors.UnsupportedAssetType,
                mimeType: createDto.mimeType
            })
        }

        const upload = await this.assetsClient.create(createDto)

        await this.assetsRepository.addAsset(movieId, upload.assetId)

        return upload
    }

    async deleteAsset(movieId: string, assetId: string): Promise<Record<string, never>> {
        await this.assetsRepository.removeAsset(movieId, assetId)
        await this.assetsClient.deleteMany([assetId])
        return {}
    }

    async completeAsset(movieId: string, assetId: string): Promise<Record<string, never>> {
        const isUploaded = await this.assetsClient.isUploadComplete(assetId)

        if (!isUploaded) {
            throw new UnprocessableEntityException({ ...MovieErrors.AssetUploadInvalid, assetId })
        }

        await this.assetsClient.complete(assetId, {
            owner: { service: 'movies', entityId: movieId }
        })

        await this.assetsRepository.removeAsset(movieId, assetId)
        await this.moviesRepository.addAsset(movieId, assetId)

        return {}
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

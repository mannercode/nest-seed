import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common'
import { AssetsClient, CreateAssetDto } from 'apps/infrastructures'
import { ensure, mapDocToDto, pickIds } from 'common'
import { uniq } from 'lodash'
import { Rules } from 'shared'
import { SearchMoviesPageDto, UpsertMovieDto } from './dtos'
import { MovieDto } from './dtos'
import { MovieErrors } from './errors'
import { Movie } from './models'
import { MoviePendingAssetsRepository } from './movie-pending-assets.repository'
import { MoviesRepository } from './movies.repository'

@Injectable()
export class MoviesService {
    constructor(
        private readonly moviesRepository: MoviesRepository,
        private readonly pendingAssetsRepository: MoviePendingAssetsRepository,
        private readonly assetsClient: AssetsClient
    ) {}

    async create(upsertDto: UpsertMovieDto) {
        const movie = await this.moviesRepository.create(upsertDto)

        return this.toDto(movie)
    }

    async createAsset(movieId: string, createDto: CreateAssetDto) {
        if (!(await this.allExist([movieId]))) {
            throw new NotFoundException(MovieErrors.NotFound(movieId))
        }

        if (!createDto.mimeType.startsWith('image/')) {
            throw new BadRequestException(MovieErrors.UnsupportedAssetType(createDto.mimeType))
        }

        const upload = await this.assetsClient.create(createDto)

        await this.pendingAssetsRepository.addPendingAsset(movieId, upload.assetId)

        return upload
    }

    async deleteAsset(movieId: string, assetId: string): Promise<void> {
        if (!(await this.allExist([movieId]))) {
            throw new NotFoundException(MovieErrors.NotFound(movieId))
        }

        await this.pendingAssetsRepository.removePendingAsset(movieId, assetId)
        await this.assetsClient.deleteMany([assetId])
    }

    async deleteMany(movieIds: string[]): Promise<void> {
        const movies = await this.moviesRepository.findByIds(movieIds)

        if (0 < movies.length) {
            const assetIds = uniq(movies.flatMap((movie) => movie.assetIds))

            if (0 < assetIds.length) {
                await this.assetsClient.deleteMany(assetIds)
            }

            await this.moviesRepository.deleteByIds(pickIds(movies))
        }
    }

    async allExist(movieIds: string[]): Promise<boolean> {
        return this.moviesRepository.allExist(movieIds)
    }

    async finalizeUpload(movieId: string, assetId: string): Promise<void> {
        const movie = await this.moviesRepository.findById(movieId)

        if (!movie) {
            throw new NotFoundException(MovieErrors.NotFound(movieId))
        }

        if (movie.assetIds.includes(assetId)) {
            await this.pendingAssetsRepository.removePendingAsset(movieId, assetId)
            return
        }

        const hasPendingAsset = await this.pendingAssetsRepository.hasPendingAsset(movieId, assetId)

        if (!hasPendingAsset) {
            throw new NotFoundException(MovieErrors.AssetNotFound(assetId))
        }

        const isUploaded = await this.assetsClient.isUploadComplete(assetId)

        if (!isUploaded) {
            throw new UnprocessableEntityException(MovieErrors.AssetUploadInvalid(assetId))
        }

        await this.assetsClient.finalizeUpload(assetId, {
            owner: { entityId: movieId, service: 'movies' }
        })

        await this.pendingAssetsRepository.removePendingAsset(movieId, assetId)
        await this.moviesRepository.addAsset(movieId, assetId)
    }

    async getMany(movieIds: string[]) {
        const movies = await this.moviesRepository.getByIds(movieIds)
        return this.toDtos(movies)
    }

    async publish(movieId: string) {
        const movie = await this.moviesRepository.getById(movieId)

        const { director, durationInSeconds, genres, plot, rating, releaseDate, title } = movie
        const defaults = Rules.Movie.defaults

        const missingFields: string[] = []
        if (title === defaults.title) missingFields.push('title')
        if (releaseDate.getTime() === defaults.releaseDate.getTime())
            missingFields.push('releaseDate')
        if (plot === defaults.plot) missingFields.push('plot')
        if (durationInSeconds === defaults.durationInSeconds)
            missingFields.push('durationInSeconds')
        if (director === defaults.director) missingFields.push('director')
        if (rating === defaults.rating) missingFields.push('rating')
        if (genres.length === 0) missingFields.push('genres')

        if (0 < missingFields.length) {
            throw new UnprocessableEntityException(MovieErrors.InvalidForPublish(missingFields))
        }

        await this.moviesRepository.publish(movieId)
        return this.toDto(movie)
    }

    async searchPage(searchDto: SearchMoviesPageDto) {
        const { items, ...pagination } = await this.moviesRepository.searchPage(searchDto)

        return { ...pagination, items: await this.toDtos(items) }
    }

    async update(movieId: string, upsertDto: UpsertMovieDto) {
        const movie = await this.moviesRepository.update(movieId, upsertDto)
        return this.toDto(movie)
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

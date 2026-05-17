import { ensure, mapDocToDto, pickIds, uniq } from '@mannercode/common'
import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common'
import { AssetsService, CreateAssetDto } from 'infrastructure'
import { SearchMoviesPageDto, UpsertMovieDto, MovieDto } from './dtos'
import { MovieErrors } from './errors'
import { Movie, MovieDefaults } from './models'
import { MoviePendingAssetsRepository } from './movie-pending-assets.repository'
import { MoviesRepository } from './movies.repository'

@Injectable()
export class MoviesService {
    constructor(
        private readonly moviesRepository: MoviesRepository,
        private readonly pendingAssetsRepository: MoviePendingAssetsRepository,
        private readonly assetsService: AssetsService
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

        const upload = await this.assetsService.create(createDto)

        await this.pendingAssetsRepository.addPendingAsset(movieId, upload.assetId)

        return upload
    }

    async deleteAsset(movieId: string, assetId: string): Promise<void> {
        const movie = await this.moviesRepository.findById(movieId)

        if (!movie) {
            throw new NotFoundException(MovieErrors.NotFound(movieId))
        }

        // 자산을 먼저 끊은 뒤 실제 데이터를 지운다. 순서를 뒤집으면 자산이
        // 사라진 뒤에도 영화나 pending 목록에 dangling reference가 남는다.
        if (movie.assetIds.includes(assetId)) {
            await this.moviesRepository.removeAsset(movieId, assetId)
        }
        await this.pendingAssetsRepository.removePendingAsset(movieId, assetId)
        await this.assetsService.deleteMany([assetId])
    }

    async deleteMany(movieIds: string[]): Promise<void> {
        const movies = await this.moviesRepository.findByIds(movieIds)

        if (0 < movies.length) {
            const assetIds = uniq(movies.flatMap((movie) => movie.assetIds))

            if (0 < assetIds.length) {
                await this.assetsService.deleteMany(assetIds)
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

        const isUploaded = await this.assetsService.isUploadComplete(assetId)

        if (!isUploaded) {
            throw new UnprocessableEntityException(MovieErrors.AssetUploadInvalid(assetId))
        }

        await this.assetsService.finalizeUpload(assetId, {
            owner: { entityId: movieId, service: 'movies' }
        })

        // 영화 문서가 자산을 참조한 뒤 pending 목록에서 제거해야 재시도할 수 있다.
        // 순서를 바꾸면 `addAsset` 실패 뒤 자산 소유자만 영화로 바뀌고, 영화와
        // pending 목록 어디에도 복구 단서가 남지 않는다.
        await this.moviesRepository.addAsset(movieId, assetId)
        await this.pendingAssetsRepository.removePendingAsset(movieId, assetId)
    }

    async getMany(movieIds: string[]) {
        const movies = await this.moviesRepository.getByIds(movieIds)
        return this.toDtos(movies)
    }

    async publish(movieId: string) {
        const movie = await this.moviesRepository.getById(movieId)

        const { director, durationInSeconds, genres, plot, rating, releaseDate, title } = movie
        const defaults = MovieDefaults

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
        const assetIds = uniq(movies.flatMap((movie) => movie.assetIds))
        const assetUrlById = new Map<string, string>()

        if (0 < assetIds.length) {
            const assets = await this.assetsService.findMany(assetIds)
            assets.forEach((asset) => assetUrlById.set(asset.id, ensure(asset.download).url))
        }

        return movies.map((movie) => {
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
            dto.imageUrls = movie.assetIds
                .map((assetId) => assetUrlById.get(assetId))
                .filter((url): url is string => url !== undefined)
            return dto
        })
    }
}

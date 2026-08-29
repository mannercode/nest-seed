import type { ClientSession } from 'mongoose'
import { ensure, mapDocToDto, pickIds, uniq } from '@mannercode/common'
import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common'
import { AssetsService, CreateAssetDto } from '#infrastructure'
import { SearchMoviesPageDto, UpsertMovieDto, MovieDto } from './dtos/index.js'
import { MovieErrors } from './errors.js'
import { Movie, MovieDefaults } from './models/index.js'
import { MoviePendingAssetsRepository } from './movie-pending-assets.repository.js'
import { MoviesRepository } from './movies.repository.js'

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

        const isAttached = movie.assetIds.includes(assetId)
        const isPending = await this.pendingAssetsRepository.hasPendingAsset(movieId, assetId)
        const owner = await this.assetsService.findOwner(assetId)

        if (owner === undefined && !isAttached && !isPending) {
            // 이미 사라진 asset 삭제는 멱등하게 성공한다.
            return
        }

        const belongsToMovie = owner?.service === 'movies' && owner.entityId === movieId
        const isOwnedPendingUpload = owner === null && isPending

        // 영화 문서의 assetIds는 복구 과정이나 과거 버그로 오염될 수 있으므로 실제 asset owner를
        // 최종 권한 기준으로 삼는다. 아직 finalize 전인 pending upload만 owner가 없어도 허용한다.
        if (owner !== undefined && !belongsToMovie && !isOwnedPendingUpload) {
            throw new NotFoundException(MovieErrors.AssetNotFound(assetId))
        }

        // 파일을 먼저 영화와 대기 목록에서 제거한 뒤 실제 저장소에서 삭제한다.
        // 순서를 바꾸면 이미 삭제된 파일을 계속 가리키는 기록이 남을 수 있다.
        if (isAttached) {
            await this.moviesRepository.removeAsset(movieId, assetId)
        }
        if (isPending) {
            await this.pendingAssetsRepository.removePendingAsset(movieId, assetId)
        }
        await this.assetsService.deleteMany([assetId])
    }

    async deleteMany(movieIds: string[]): Promise<void> {
        const movies = await this.moviesRepository.findByIds(movieIds)

        if (0 < movies.length) {
            const existingMovieIds = pickIds(movies)
            const pendingAssetIds =
                await this.pendingAssetsRepository.findAssetIdsByMovieIds(existingMovieIds)
            const candidateAssetIds = uniq([
                ...movies.flatMap((movie) => movie.assetIds),
                ...pendingAssetIds
            ])
            const ownerByAssetId = await this.assetsService.findOwners(candidateAssetIds)
            const existingMovieIdSet = new Set(existingMovieIds)
            const pendingAssetIdSet = new Set(pendingAssetIds)
            const assetIds = candidateAssetIds.filter((assetId) => {
                const owner = ownerByAssetId.get(assetId)
                const belongsToDeletedMovie =
                    owner?.service === 'movies' && existingMovieIdSet.has(owner.entityId)
                const isPendingUpload = owner === null && pendingAssetIdSet.has(assetId)

                return belongsToDeletedMovie || isPendingUpload
            })

            if (0 < assetIds.length) {
                await this.assetsService.deleteMany(assetIds)
            }

            await this.pendingAssetsRepository.removeByMovieIds(existingMovieIds)
            await this.moviesRepository.deleteByIds(existingMovieIds)
        }
    }

    async allExist(
        movieIds: string[],
        session: ClientSession | undefined = undefined,
        signal: AbortSignal | undefined = undefined
    ): Promise<boolean> {
        return this.moviesRepository.allExist(movieIds, session, signal)
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

        // 업로드한 파일을 영화에 연결한 뒤 대기 목록에서 제거한다.
        // 연결 중 실패하더라도 대기 목록이 남아 있어 다시 처리할 수 있다.
        await this.moviesRepository.addAsset(movieId, assetId)
        await this.pendingAssetsRepository.removePendingAsset(movieId, assetId)
    }

    async getMany(movieIds: string[]) {
        const movies = await this.moviesRepository.getByIds(movieIds)
        return this.toDtos(movies)
    }

    // 공개 카탈로그용 단건 조회. 미공개(draft) 영화는 없는 것으로 취급한다.
    // 내부 흐름(추천·관람 기록)은 비공개 전환된 영화도 조회해야 하므로 getMany를 그대로 둔다.
    async getPublished(movieId: string) {
        const movie = ensure((await this.moviesRepository.getByIds([movieId]))[0])

        if (!movie.isPublished) {
            throw new NotFoundException(MovieErrors.NotFound(movieId))
        }

        const [dto] = await this.toDtos([movie])
        return ensure(dto)
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
        return ensure((await this.toDtos([movie]))[0])
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

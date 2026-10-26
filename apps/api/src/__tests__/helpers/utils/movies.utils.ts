import { nullPlainDate, type TestContext } from '@mannercode/testing'
import { MovieGenre, MovieRating, type MovieDto, type UpsertMovieDto, MoviesService } from '#core'
import { testAssets, type TestAsset } from '../assets/index.js'
import { buildCreateAssetDto, uploadAsset } from './assets.utils.js'
import { MoviesRepository } from '../../../services/core/movies/movies.repository.js'
import { MoviePendingAssetsRepository } from '../../../services/core/movies/movie-pending-assets.repository.js'

export function buildCreateMovieDto(overrides: Partial<UpsertMovieDto> = {}): UpsertMovieDto {
    return {
        director: 'Quentin Tarantino',
        durationInSeconds: 90 * 60,
        genres: [MovieGenre.Action],
        plot: `MoviePlot`,
        rating: MovieRating.PG,
        releaseDate: nullPlainDate,
        title: `MovieTitle`,
        ...overrides
    }
}

export async function createMovie(
    ctx: TestContext,
    override: Partial<UpsertMovieDto> = {}
): Promise<MovieDto> {
    const moviesService = ctx.module.get(MoviesService)

    const createDto = buildCreateMovieDto(override)

    const movie = await moviesService.create(createDto)
    await moviesService.publish(movie.id)
    return movie
}

export async function createUnpublishedMovie(ctx: TestContext): Promise<MovieDto> {
    const moviesService = ctx.module.get(MoviesService)

    const movie = await moviesService.create({})
    return movie
}

export async function createMovieAsset(ctx: TestContext, movieId: string, file: TestAsset) {
    const moviesService = ctx.module.get(MoviesService)

    const createDto = buildCreateAssetDto(file)
    const upload = await moviesService.createAsset(movieId, createDto)

    return upload
}

export async function uploadMovieAsset(ctx: TestContext, movieId: string) {
    const { image } = testAssets

    const upload = await createMovieAsset(ctx, movieId, image)
    const uploadResponse = await uploadAsset(image.path, upload)

    expect(uploadResponse.ok).toBe(true)

    return upload
}

export async function uploadAndFinalizeMovieAsset(ctx: TestContext, movieId: string) {
    const moviesService = ctx.module.get(MoviesService)

    const { assetId } = await uploadMovieAsset(ctx, movieId)

    await moviesService.finalizeUpload(movieId, assetId)
    return assetId
}

export function pauseNextMovieAssetAttachment(ctx: TestContext) {
    const repository = ctx.module.get(MoviesRepository)
    const addAsset = repository.addAsset.bind(repository)
    const started = Promise.withResolvers<void>()
    const held = Promise.withResolvers<void>()
    vi.spyOn(repository, 'addAsset').mockImplementationOnce(async (...args) => {
        started.resolve()
        await held.promise
        return addAsset(...args)
    })
    return { started: started.promise, release: held.resolve }
}

export function pauseNextPendingAssetLookup(ctx: TestContext) {
    const repository = ctx.module.get(MoviePendingAssetsRepository)
    const findAssetIds = repository.findAssetIds.bind(repository)
    const started = Promise.withResolvers<void>()
    const held = Promise.withResolvers<void>()
    vi.spyOn(repository, 'findAssetIds').mockImplementationOnce(async (...args) => {
        started.resolve()
        await held.promise
        return findAssetIds(...args)
    })
    return { started: started.promise, release: held.resolve }
}

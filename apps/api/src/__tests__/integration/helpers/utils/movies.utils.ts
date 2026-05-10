import type { TestContext } from '@mannercode/testing'
import { MovieGenre, MovieRating, type MovieDto, type UpsertMovieDto } from 'core'
import { testAssets, type TestAsset } from '../assets'
import { buildCreateAssetDto, uploadAsset } from './assets.utils'

export function buildCreateMovieDto(overrides: Partial<UpsertMovieDto> = {}): UpsertMovieDto {
    return {
        assetIds: [] as string[],
        director: 'Quentin Tarantino',
        durationInSeconds: 90 * 60,
        genres: [MovieGenre.Action],
        plot: `MoviePlot`,
        rating: MovieRating.PG,
        releaseDate: new Date(0),
        title: `MovieTitle`,
        ...overrides
    }
}

export async function createMovie(
    ctx: TestContext,
    override: Partial<UpsertMovieDto> = {}
): Promise<MovieDto> {
    const { MoviesService } = await import('core')
    const moviesService = ctx.module.get(MoviesService)

    const createDto = buildCreateMovieDto(override)

    const movie = await moviesService.create(createDto)
    await moviesService.publish(movie.id)
    return movie
}

export async function createUnpublishedMovie(ctx: TestContext): Promise<MovieDto> {
    const { MoviesService } = await import('core')
    const moviesService = ctx.module.get(MoviesService)

    const movie = await moviesService.create({})
    return movie
}

export async function createMovieAsset(ctx: TestContext, movieId: string, file: TestAsset) {
    const { MoviesService } = await import('core')
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
    const { MoviesService } = await import('core')
    const moviesService = ctx.module.get(MoviesService)

    const { assetId } = await uploadMovieAsset(ctx, movieId)

    await moviesService.finalizeUpload(movieId, assetId)
    return assetId
}

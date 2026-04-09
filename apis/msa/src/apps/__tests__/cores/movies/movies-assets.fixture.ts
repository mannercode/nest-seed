import type { TestContext } from '@mannercode/testing'
import type { AssetsClient } from 'infrastructures'
import { buildCreateAssetDto, testAssets, uploadAsset, TestAsset } from '../../__helpers__'
import { createMoviesContext, MoviesBaseContext } from './create-movies-context'

export type MoviesAssetsFixture = MoviesBaseContext & {
    asset: TestAsset
    assetsClient: AssetsClient
}

export { createUnpublishedMovie } from './create-movies-context'

export async function createMovieAsset(ctx: TestContext, movieId: string, file: TestAsset) {
    const { MoviesService } = await import('cores')
    const moviesService = ctx.module.get(MoviesService)

    const createDto = buildCreateAssetDto(file)
    const upload = await moviesService.createAsset(movieId, createDto)

    return upload
}

export async function createMoviesAssetsFixture() {
    const ctx = await createMoviesContext()

    const { AssetsClient } = await import('infrastructures')
    const assetsClient = ctx.module.get(AssetsClient)

    return { ...ctx, asset: testAssets.image, assetsClient }
}

export async function uploadAndFinalizeMovieAsset(ctx: TestContext, movieId: string) {
    const { MoviesService } = await import('cores')
    const moviesService = ctx.module.get(MoviesService)

    const { assetId } = await uploadMovieAsset(ctx, movieId)

    await moviesService.finalizeUpload(movieId, assetId)
    return assetId
}

export async function uploadMovieAsset(ctx: TestContext, movieId: string) {
    const { image } = testAssets

    const upload = await createMovieAsset(ctx, movieId, image)
    const uploadResponse = await uploadAsset(image.path, upload)

    expect(uploadResponse.ok).toBe(true)

    return upload
}

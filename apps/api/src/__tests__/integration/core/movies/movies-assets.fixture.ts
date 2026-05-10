import type { TestContext } from '@mannercode/testing'
import { buildCreateAssetDto, testAssets, uploadAsset, type TestAsset } from '../../helpers'

export async function createMovieAsset(ctx: TestContext, movieId: string, file: TestAsset) {
    const { MoviesService } = await import('core')
    const moviesService = ctx.module.get(MoviesService)

    const createDto = buildCreateAssetDto(file)
    const upload = await moviesService.createAsset(movieId, createDto)

    return upload
}

export async function uploadAndFinalizeMovieAsset(ctx: TestContext, movieId: string) {
    const { MoviesService } = await import('core')
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

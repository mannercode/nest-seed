import type { AppTestContext, TestAsset } from 'apps/__tests__/__helpers__'
import type { TestContext } from 'testlib'
import {
    buildCreateAssetDto,
    createAppTestContext,
    testAssets,
    uploadAsset
} from 'apps/__tests__/__helpers__'
import { RecommendationClient } from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesHttpController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'

export type MoviesAssetsFixture = AppTestContext & { asset: TestAsset; assetsClient: AssetsClient }

export async function createMovie(ctx: TestContext) {
    const { MoviesService } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesService)

    const movie = await moviesService.create({})
    return movie
}

export async function createMovieAsset(ctx: TestContext, movieId: string, file: TestAsset) {
    const { MoviesService } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesService)

    const createDto = buildCreateAssetDto(file)
    const upload = await moviesService.createAsset(movieId, createDto)

    return upload
}

export async function createMoviesAssetsFixture() {
    const ctx = await createAppTestContext({
        controllers: [MoviesHttpController],
        ignoreProviders: [RecommendationClient],
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, AssetsClient]
    })

    const assetsClient = ctx.module.get(AssetsClient)

    return { ...ctx, asset: testAssets.image, assetsClient }
}

export async function uploadAndFinalizeMovieAsset(ctx: TestContext, movieId: string) {
    const { MoviesService } = await import('apps/cores')
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

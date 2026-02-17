import {
    buildCreateAssetDto,
    createAppTestContext,
    testAssets,
    uploadAsset
} from 'apps/__tests__/__helpers__'
import { RecommendationClient } from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import type { AppTestContext, TestAsset } from 'apps/__tests__/__helpers__'
import type { TestContext } from 'testlib'

export type MoviesAssetsFixture = AppTestContext & { assetsClient: AssetsClient; asset: TestAsset }

export async function createMoviesAssetsFixture() {
    const ctx = await createAppTestContext({
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, AssetsClient],
        controllers: [MoviesController],
        ignoreProviders: [RecommendationClient]
    })

    const assetsClient = ctx.module.get(AssetsClient)

    return { ...ctx, assetsClient, asset: testAssets.image }
}

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

export async function uploadMovieAsset(ctx: TestContext, movieId: string) {
    const { image } = testAssets

    const upload = await createMovieAsset(ctx, movieId, image)
    const uploadResponse = await uploadAsset(image.path, upload)

    expect(uploadResponse.ok).toBe(true)

    return upload
}

export async function uploadCompleteMovieAsset(ctx: TestContext, movieId: string) {
    const { MoviesService } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesService)

    const { assetId } = await uploadMovieAsset(ctx, movieId)

    await moviesService.completeAsset(movieId, assetId)
    return assetId
}

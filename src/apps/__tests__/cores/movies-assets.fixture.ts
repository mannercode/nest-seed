import { RecommendationClient } from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import {
    buildCreateAssetDto,
    createAppTestContext,
    fixtureFiles,
    uploadAsset
} from '../__helpers__'
import type { AppTestContext, FixtureFile } from '../__helpers__'
import type { TestContext } from 'testlib'

export type MoviesAssetsFixture = AppTestContext & {
    assetsClient: AssetsClient
    asset: FixtureFile
}

export async function createMoviesAssetsFixture() {
    const ctx = await createAppTestContext({
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, AssetsClient],
        controllers: [MoviesController],
        ignoreProviders: [RecommendationClient]
    })

    const assetsClient = ctx.module.get(AssetsClient)

    return { ...ctx, assetsClient, asset: fixtureFiles.image }
}

export async function createMovie(ctx: TestContext) {
    const { MoviesService } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesService)

    const movie = await moviesService.create({})
    return movie
}

export async function createMovieAsset(ctx: TestContext, movieId: string, file: FixtureFile) {
    const { MoviesService } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesService)

    const createDto = buildCreateAssetDto(file)
    const upload = await moviesService.createAsset(movieId, createDto)

    return upload
}

export async function uploadMovieAsset(ctx: TestContext, movieId: string) {
    const { image } = fixtureFiles

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

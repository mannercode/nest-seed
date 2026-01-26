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

export type MoviesFixture = AppTestContext & { assetsClient: AssetsClient; asset: FixtureFile }

export async function createMoviesFixture() {
    const ctx = await createAppTestContext({
        imports: [MoviesModule, AssetsModule, MoviesModule],
        providers: [MoviesClient, MoviesClient, AssetsClient],
        controllers: [MoviesController, MoviesController],
        ignoreProviders: [RecommendationClient]
    })

    // TODO 이거 없애야 한다.
    const assetsClient = ctx.module.get(AssetsClient)

    return { ...ctx, assetsClient, asset: fixtureFiles.image }
}

export async function createMovie(ctx: TestContext) {
    const { MoviesService } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesService)

    const movie = await moviesService.create({})
    return movie
}

export async function createMovieAsset(ctx: TestContext, draftId: string, file: FixtureFile) {
    const { MoviesService } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesService)

    const createDto = buildCreateAssetDto(file)
    const upload = await moviesService.createAsset(draftId, createDto)

    return upload
}

export async function uploadMovieAsset(ctx: TestContext, draftId: string) {
    const { image } = fixtureFiles

    const upload = await createMovieAsset(ctx, draftId, image)
    const uploadResponse = await uploadAsset(image.path, upload)

    expect(uploadResponse.ok).toBe(true)

    return upload
}

export async function uploadCompleteMovieAsset(ctx: TestContext, draftId: string) {
    const { MoviesService } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesService)

    const { assetId } = await uploadMovieAsset(ctx, draftId)

    await moviesService.completeAsset(draftId, assetId)
    return assetId
}

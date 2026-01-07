import { MovieDraftsClient, MovieDraftsModule, RecommendationClient } from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MovieDraftsController, MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import {
    buildCreateAssetDto,
    createAppTestContext,
    fixtureFiles,
    uploadAsset
} from '../__helpers__'
import type { AppTestContext, FixtureFile } from '../__helpers__'
import type { TestContext } from 'testlib'

export type MovieDraftsFixture = AppTestContext & { assetsClient: AssetsClient; asset: FixtureFile }

export async function createMovieDraftsFixture() {
    const ctx = await createAppTestContext({
        imports: [MoviesModule, AssetsModule, MovieDraftsModule],
        providers: [MoviesClient, MovieDraftsClient, AssetsClient],
        controllers: [MoviesController, MovieDraftsController],
        ignoreProviders: [RecommendationClient]
    })

    // TODO 이거 없애야 한다.
    const assetsClient = ctx.module.get(AssetsClient)

    return { ...ctx, assetsClient, asset: fixtureFiles.image }
}

export async function createMovieDraft(ctx: TestContext) {
    const { MovieDraftsService } = await import('apps/applications')
    const movieDraftsService = ctx.module.get(MovieDraftsService)

    const movieDraft = await movieDraftsService.createMovieDraft()
    return movieDraft
}

export async function createMovieAssetDraft(ctx: TestContext, movieId: string, file: FixtureFile) {
    const { MovieDraftsService } = await import('apps/applications')
    const movieDraftsService = ctx.module.get(MovieDraftsService)

    const createDto = buildCreateAssetDto(file)
    const upload = await movieDraftsService.createAssetDraft(movieId, createDto)

    return upload
}

export async function uploadDraftAsset(ctx: TestContext, movieId: string) {
    const { image } = fixtureFiles

    const upload = await createMovieAssetDraft(ctx, movieId, image)
    const uploadResponse = await uploadAsset(image.path, upload)

    expect(uploadResponse.ok).toBe(true)

    return upload
}

export async function uploadCompleteDraftAsset(ctx: TestContext, movieId: string) {
    const { MovieDraftsService } = await import('apps/applications')
    const movieDraftsService = ctx.module.get(MovieDraftsService)

    const { assetId: assetId } = await uploadDraftAsset(ctx, movieId)

    await movieDraftsService.completeAssetDraft(movieId, assetId)
    return assetId
}

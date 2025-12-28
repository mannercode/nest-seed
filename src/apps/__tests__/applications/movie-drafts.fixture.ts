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

export type MovieDraftsFixture = AppTestContext & { assetsClient: AssetsClient }

export async function createMovieDraftsFixture() {
    const ctx = await createAppTestContext({
        imports: [MoviesModule, AssetsModule, MovieDraftsModule],
        providers: [MoviesClient, MovieDraftsClient, AssetsClient],
        controllers: [MoviesController, MovieDraftsController],
        ignoreProviders: [RecommendationClient]
    })

    const assetsClient = ctx.module.get(AssetsClient)

    return { ...ctx, assetsClient }
}

export async function createMovieDraft(ctx: TestContext) {
    const { MovieDraftsClient } = await import('apps/applications')
    const movieDraftsClient = ctx.module.get(MovieDraftsClient)

    const movieDraft = await movieDraftsClient.create()
    return movieDraft
}

export async function createMovieImageDraft(ctx: TestContext, draftId: string, file: FixtureFile) {
    const { MovieDraftsClient } = await import('apps/applications')
    const movieDraftsClient = ctx.module.get(MovieDraftsClient)

    const createDto = buildCreateAssetDto(file)
    const upload = await movieDraftsClient.requestImageUpload(draftId, createDto)

    return upload
}

export async function uploadDraftImage(ctx: TestContext, draftId: string) {
    const imageFile = fixtureFiles.image

    const upload = await createMovieImageDraft(ctx, draftId, imageFile)
    const uploadResponse = await uploadAsset(imageFile.path, upload.upload)

    expect(uploadResponse.ok).toBe(true)

    return upload
}

export async function uploadCompleteDraftImage(ctx: TestContext, draftId: string) {
    const { MovieDraftsClient } = await import('apps/applications')
    const movieDraftsClient = ctx.module.get(MovieDraftsClient)

    const { imageId } = await uploadDraftImage(ctx, draftId)

    await movieDraftsClient.completeImage(draftId, imageId)
    return imageId
}

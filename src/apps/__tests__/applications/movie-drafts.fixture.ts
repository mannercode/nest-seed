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

export type MovieDraftsFixture = AppTestContext & { assetsClient: AssetsClient; image: FixtureFile }

export async function createMovieDraftsFixture() {
    const ctx = await createAppTestContext({
        imports: [MoviesModule, AssetsModule, MovieDraftsModule],
        providers: [MoviesClient, MovieDraftsClient, AssetsClient],
        controllers: [MoviesController, MovieDraftsController],
        ignoreProviders: [RecommendationClient]
    })

    // TODO 이거 없애야 한다.
    const assetsClient = ctx.module.get(AssetsClient)

    return { ...ctx, assetsClient, image: fixtureFiles.image }
}

export async function createMovieDraft(ctx: TestContext) {
    const { MovieDraftsService } = await import('apps/applications')
    const movieDraftsService = ctx.module.get(MovieDraftsService)

    const movieDraft = await movieDraftsService.create()
    return movieDraft
}

export async function createMovieImageDraft(ctx: TestContext, draftId: string, file: FixtureFile) {
    const { MovieDraftsService } = await import('apps/applications')
    const movieDraftsService = ctx.module.get(MovieDraftsService)

    const createDto = buildCreateAssetDto(file)
    const upload = await movieDraftsService.requestImageUpload(draftId, createDto)

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
    const { MovieDraftsService } = await import('apps/applications')
    const movieDraftsService = ctx.module.get(MovieDraftsService)

    const { imageId } = await uploadDraftImage(ctx, draftId)

    await movieDraftsService.completeImage(draftId, imageId)
    return imageId
}

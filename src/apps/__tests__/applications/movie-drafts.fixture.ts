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
import type { AppTestContext } from '../__helpers__'
import type { MovieDraftDto } from 'apps/applications'
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

export async function createMovieDraft(ctx: TestContext): Promise<MovieDraftDto> {
    const { MovieDraftsClient } = await import('apps/applications')
    const movieDraftsClient = ctx.module.get(MovieDraftsClient)

    const movieDraft = await movieDraftsClient.create()
    return movieDraft
}

export const uploadDraftImage = async (ctx: TestContext, draftId: string) => {
    const { MovieDraftsClient } = await import('apps/applications')
    const movieDraftsClient = ctx.module.get(MovieDraftsClient)

    const imageFile = fixtureFiles.image
    const createDto = buildCreateAssetDto(imageFile)
    const upload = await movieDraftsClient.requestImageUpload(draftId, createDto)
    const uploadResponse = await uploadAsset(imageFile.path, upload.upload)

    expect(uploadResponse.ok).toBe(true)

    return upload
}

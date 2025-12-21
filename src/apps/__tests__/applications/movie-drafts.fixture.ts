import { MovieDraftsClient, MovieDraftsModule, RecommendationClient } from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MovieDraftsController, MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { createAppTestContext } from '../__helpers__'
import type { AppTestContext } from '../__helpers__'
import type { MovieDraftDto } from 'apps/applications'
import type { TestContext } from 'testlib'

export type MovieDraftsFixture = AppTestContext & {}

export async function createMovieDraftsFixture() {
    const ctx = await createAppTestContext({
        imports: [MoviesModule, AssetsModule, MovieDraftsModule],
        providers: [MoviesClient, MovieDraftsClient, AssetsClient],
        controllers: [MoviesController, MovieDraftsController],
        ignoreProviders: [RecommendationClient]
    })

    return { ...ctx }
}

export async function createMovieDraft(ctx: TestContext): Promise<MovieDraftDto> {
    const { MovieDraftsClient } = await import('apps/applications')
    const movieDraftsClient = ctx.module.get(MovieDraftsClient)

    // 이미지 포함 업데이트까지 다
    const movieDraft = await movieDraftsClient.create()
    return movieDraft
}

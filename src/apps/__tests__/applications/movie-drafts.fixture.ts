import type { MovieDraftDto } from 'apps/applications'
import { MovieDraftsClient, MovieDraftsModule, RecommendationClient } from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MovieDraftsController, MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import type { TestContext } from 'testlib'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

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

// TODO eslint sort 추가
// TODO client인데 service라고 한 코드 다 고쳐라
export async function createMovieDraft(ctx: TestContext): Promise<MovieDraftDto> {
    const { MovieDraftsClient } = await import('apps/applications')
    const movieDraftsService = ctx.module.get(MovieDraftsClient)

    // 이미지 포함 업데이트까지 다
    const movieDraft = await movieDraftsService.create()
    return movieDraft
}

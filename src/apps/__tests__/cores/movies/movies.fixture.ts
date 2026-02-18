import type { AppTestContext } from 'apps/__tests__/__helpers__'
import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { RecommendationClient } from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'

export type MoviesFixture = AppTestContext & { moviesClient: MoviesClient }

export async function createMoviesFixture() {
    const ctx = await createAppTestContext({
        controllers: [MoviesController],
        ignoreProviders: [RecommendationClient],
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, AssetsClient]
    })

    const moviesClient = ctx.module.get(MoviesClient)

    return { ...ctx, moviesClient }
}

import { RecommendationClient } from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { createAppTestContext } from '../__helpers__'
import type { AppTestContext } from '../__helpers__'

export type MoviesFixture = AppTestContext & { moviesClient: MoviesClient }

export async function createMoviesFixture() {
    const ctx = await createAppTestContext({
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, AssetsClient],
        ignoreProviders: [RecommendationClient],
        controllers: [MoviesController]
    })

    const moviesClient = ctx.module.get(MoviesClient)

    return { ...ctx, moviesClient }
}

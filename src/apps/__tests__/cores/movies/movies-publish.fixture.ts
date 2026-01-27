import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { RecommendationClient } from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import type { AppTestContext } from 'apps/__tests__/__helpers__'
import type { MovieDto } from 'apps/cores'
import type { TestContext } from 'testlib'

export type MoviesPublishFixture = AppTestContext & { moviesClient: MoviesClient }

export async function createMoviesPublishFixture() {
    const ctx = await createAppTestContext({
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, AssetsClient],
        ignoreProviders: [RecommendationClient],
        controllers: [MoviesController]
    })

    const moviesClient = ctx.module.get(MoviesClient)

    return { ...ctx, moviesClient }
}

export async function createUnpublishedMovie(ctx: TestContext): Promise<MovieDto> {
    const { MoviesService } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesService)

    const movie = await moviesService.create({})
    return movie
}

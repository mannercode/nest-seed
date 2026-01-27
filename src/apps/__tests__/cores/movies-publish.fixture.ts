import { RecommendationClient } from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { createAppTestContext } from '../__helpers__'
import type { AppTestContext } from '../__helpers__'
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

export async function createUnpublishedMovie(ctx: TestContext, override = {}): Promise<MovieDto> {
    const { MoviesService } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesService)

    // const createDto = buildCreateMovieDto(override)

    const movie = await moviesService.create({})
    return movie
}

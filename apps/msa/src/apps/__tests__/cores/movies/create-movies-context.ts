import type { TestContext } from '@mannercode/testing'
import { RecommendationClient } from 'applications'
import { MoviesClient, MoviesModule, MovieDto } from 'cores'
import { MoviesHttpController } from 'gateway'
import { AssetsClient, AssetsModule } from 'infrastructures'
import { createAppTestContext, AppTestContext } from '../../__helpers__'

export type MoviesBaseContext = AppTestContext

export async function createMoviesContext(): Promise<MoviesBaseContext> {
    return createAppTestContext({
        controllers: [MoviesHttpController],
        ignoreProviders: [RecommendationClient],
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, AssetsClient]
    })
}

export async function createUnpublishedMovie(ctx: TestContext): Promise<MovieDto> {
    const { MoviesService } = await import('cores')
    const moviesService = ctx.module.get(MoviesService)

    const movie = await moviesService.create({})
    return movie
}

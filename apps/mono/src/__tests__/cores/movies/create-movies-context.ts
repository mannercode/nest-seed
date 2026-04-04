import type { TestContext } from '@mannercode/testing'
import { RecommendationService } from 'applications'
import { MoviesHttpController } from 'controllers'
import { MoviesModule, MovieDto } from 'cores'
import { AssetsModule } from 'infrastructures'
import { createAppTestContext, AppTestContext } from '../../__helpers__'

export type MoviesBaseContext = AppTestContext

export async function createMoviesContext(): Promise<MoviesBaseContext> {
    return createAppTestContext({
        controllers: [MoviesHttpController],
        ignoreProviders: [RecommendationService],
        imports: [MoviesModule, AssetsModule]
    })
}

export async function createUnpublishedMovie(ctx: TestContext): Promise<MovieDto> {
    const { MoviesService } = await import('cores')
    const moviesService = ctx.module.get(MoviesService)

    const movie = await moviesService.create({})
    return movie
}

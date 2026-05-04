import type { TestContext } from '@mannercode/testing'
import { RecommendationService } from 'applications'
import { MoviesModule, type MovieDto } from 'cores'
import { MoviesHttpController } from 'gateway'
import { AssetsModule } from 'infrastructures'
import { createAppTestContext, type AppTestContext } from '../../__helpers__'

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

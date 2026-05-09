import type { TestContext } from '@mannercode/testing'
import { RecommendationService } from 'application'
import { MoviesModule, type MovieDto } from 'core'
import { MoviesHttpController } from 'gateway'
import { AssetsModule } from 'infrastructure'
import { createAppTestContext, type AppTestContext } from '../../helpers'

export type MoviesBaseContext = AppTestContext

export async function createMoviesContext(): Promise<MoviesBaseContext> {
    return createAppTestContext({
        controllers: [MoviesHttpController],
        ignoreProviders: [RecommendationService],
        imports: [MoviesModule, AssetsModule]
    })
}

export async function createUnpublishedMovie(ctx: TestContext): Promise<MovieDto> {
    const { MoviesService } = await import('core')
    const moviesService = ctx.module.get(MoviesService)

    const movie = await moviesService.create({})
    return movie
}

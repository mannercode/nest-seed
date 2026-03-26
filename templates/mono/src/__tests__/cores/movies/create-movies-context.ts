import type { TestContext } from '@mannercode/testing'
import type { MovieDto } from 'cores'
import { RecommendationService } from 'applications'
import { MoviesHttpController } from 'controllers'
import { MoviesModule } from 'cores'
import { AssetsModule } from 'infrastructures'
import type { AppTestContext } from '../../__helpers__'
import { createAppTestContext } from '../../__helpers__'

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

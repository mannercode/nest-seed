import type { TestContext } from '@mannercode/testing'
import { MoviesClient, MoviesHttpModule, MovieDto } from 'cores'
import { AssetsClient, AssetsModule } from 'infrastructures'
import { createAppTestContext, AppTestContext } from '../../__helpers__'

export type MoviesBaseContext = AppTestContext

export async function createMoviesContext(): Promise<MoviesBaseContext> {
    return createAppTestContext({
        imports: [MoviesHttpModule, AssetsModule],
        providers: [MoviesClient, AssetsClient]
    })
}

export async function createUnpublishedMovie(ctx: TestContext): Promise<MovieDto> {
    const { MoviesService } = await import('cores')
    const moviesService = ctx.module.get(MoviesService)

    const movie = await moviesService.create({})
    return movie
}

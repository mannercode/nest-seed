import type { MoviesService } from 'cores'
import type { MoviesBaseContext } from './create-movies-context'
import { createMoviesContext } from './create-movies-context'

export type MoviesPublishFixture = MoviesBaseContext & { moviesService: MoviesService }

export { createUnpublishedMovie } from './create-movies-context'

export async function createMoviesPublishFixture() {
    const ctx = await createMoviesContext()

    const { MoviesService } = await import('cores')
    const moviesService = ctx.module.get(MoviesService)

    return { ...ctx, moviesService }
}

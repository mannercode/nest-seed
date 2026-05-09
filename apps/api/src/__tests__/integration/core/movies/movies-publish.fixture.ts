import type { MoviesService } from 'core'
import { createMoviesContext, type MoviesBaseContext } from './create-movies-context'

export type MoviesPublishFixture = MoviesBaseContext & { moviesService: MoviesService }

export { createUnpublishedMovie } from './create-movies-context'

export async function createMoviesPublishFixture() {
    const ctx = await createMoviesContext()

    const { MoviesService } = await import('core')
    const moviesService = ctx.module.get(MoviesService)

    return { ...ctx, moviesService }
}

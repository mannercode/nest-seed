import type { MoviesClient } from 'cores'
import { createMoviesContext, MoviesBaseContext } from './create-movies-context'

export type MoviesPublishFixture = MoviesBaseContext & { moviesClient: MoviesClient }

export { createUnpublishedMovie } from './create-movies-context'

export async function createMoviesPublishFixture() {
    const ctx = await createMoviesContext()

    const { MoviesClient } = await import('cores')
    const moviesClient = ctx.module.get(MoviesClient)

    return { ...ctx, moviesClient }
}

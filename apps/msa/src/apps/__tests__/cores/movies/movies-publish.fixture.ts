import type { MoviesClient } from 'apps/cores'
import { createMoviesContext, MoviesBaseContext } from './create-movies-context'

export type MoviesPublishFixture = MoviesBaseContext & { moviesClient: MoviesClient }

export { createUnpublishedMovie } from './create-movies-context'

export async function createMoviesPublishFixture() {
    const ctx = await createMoviesContext()

    const { MoviesClient } = await import('apps/cores')
    const moviesClient = ctx.module.get(MoviesClient)

    return { ...ctx, moviesClient }
}

import type { MoviesClient } from 'cores'
import { createMoviesContext, MoviesBaseContext } from './create-movies-context'

export type MoviesFixture = MoviesBaseContext & { moviesClient: MoviesClient }

export async function createMoviesFixture() {
    const ctx = await createMoviesContext()

    const { MoviesClient } = await import('cores')
    const moviesClient = ctx.module.get(MoviesClient)

    return { ...ctx, moviesClient }
}

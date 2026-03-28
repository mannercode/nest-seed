import type { MoviesClient } from 'apps/cores'
import type { MoviesBaseContext } from './create-movies-context'
import { createMoviesContext } from './create-movies-context'

export type MoviesFixture = MoviesBaseContext & { moviesClient: MoviesClient }

export async function createMoviesFixture() {
    const ctx = await createMoviesContext()

    const { MoviesClient } = await import('apps/cores')
    const moviesClient = ctx.module.get(MoviesClient)

    return { ...ctx, moviesClient }
}

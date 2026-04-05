import type { MoviesService } from 'cores'
import { createMoviesContext, MoviesBaseContext } from './create-movies-context'

export type MoviesFixture = MoviesBaseContext & { moviesService: MoviesService }

export async function createMoviesFixture() {
    const ctx = await createMoviesContext()

    const { MoviesService } = await import('cores')
    const moviesService = ctx.module.get(MoviesService)

    return { ...ctx, moviesService }
}

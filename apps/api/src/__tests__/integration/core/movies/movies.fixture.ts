import type { MoviesService } from 'core'
import { createMoviesContext, type MoviesBaseContext } from './create-movies-context'

export type MoviesFixture = MoviesBaseContext & { moviesService: MoviesService }

export async function createMoviesFixture() {
    const ctx = await createMoviesContext()

    const { MoviesService } = await import('core')
    const moviesService = ctx.module.get(MoviesService)

    return { ...ctx, moviesService }
}

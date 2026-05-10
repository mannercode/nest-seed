import type { MoviesService } from 'core'
import { createAppTestContext, type AppTestContext } from '../../helpers'

export type MoviesFixture = AppTestContext & { moviesService: MoviesService }

export async function createMoviesFixture() {
    const ctx = await createAppTestContext()

    const { MoviesService } = await import('core')
    const moviesService = ctx.module.get(MoviesService)

    return { ...ctx, moviesService }
}

import type { MoviesService } from 'core'
import { createAppTestContext, type AppTestContext } from '../../helpers'

export type MoviesPublishFixture = AppTestContext & { moviesService: MoviesService }

export async function createMoviesPublishFixture() {
    const ctx = await createAppTestContext()

    const { MoviesService } = await import('core')
    const moviesService = ctx.module.get(MoviesService)

    return { ...ctx, moviesService }
}

import { ShowtimesService } from 'core'
import { createAppTestContext, type AppTestContext } from '../helpers'

export type ShowtimesFixture = AppTestContext & { showtimesService: ShowtimesService }

export async function createShowtimesFixture() {
    const ctx = await createAppTestContext()

    const showtimesService = ctx.module.get(ShowtimesService)

    return { ...ctx, showtimesService }
}

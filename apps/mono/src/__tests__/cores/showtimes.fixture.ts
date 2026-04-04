import { ShowtimesModule, ShowtimesService } from 'cores'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type ShowtimesFixture = AppTestContext & { showtimesService: ShowtimesService }

export async function createShowtimesFixture() {
    const ctx = await createAppTestContext({ imports: [ShowtimesModule] })

    const showtimesService = ctx.module.get(ShowtimesService)

    return { ...ctx, showtimesService }
}

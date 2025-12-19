import { ShowtimesClient, ShowtimesModule } from 'apps/cores'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type ShowtimesFixture = AppTestContext & { showtimesClient: ShowtimesClient }

export async function createShowtimesFixture() {
    const ctx = await createAppTestContext({
        imports: [ShowtimesModule],
        providers: [ShowtimesClient]
    })

    const showtimesClient = ctx.module.get(ShowtimesClient)

    return { ...ctx, showtimesClient }
}

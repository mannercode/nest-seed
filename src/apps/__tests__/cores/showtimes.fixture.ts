import { ShowtimesClient, ShowtimesModule } from 'apps/cores'
import { AppTestContext, createAppTestContext } from '../__helpers__'

export type ShowtimesFixture = AppTestContext & { showtimesService: ShowtimesClient }

export async function createShowtimesFixture() {
    const ctx = await createAppTestContext({
        imports: [ShowtimesModule],
        providers: [ShowtimesClient]
    })

    const showtimesService = ctx.module.get(ShowtimesClient)

    return { ...ctx, showtimesService }
}

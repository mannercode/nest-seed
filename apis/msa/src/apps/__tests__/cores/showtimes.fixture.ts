import { ShowtimesClient, ShowtimesModule } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type ShowtimesFixture = AppTestContext & { showtimesClient: ShowtimesClient }

export async function createShowtimesFixture() {
    const ctx = await createAppTestContext({
        imports: [ShowtimesModule],
        providers: [ShowtimesClient]
    })

    const showtimesClient = ctx.module.get(ShowtimesClient)

    return { ...ctx, showtimesClient }
}

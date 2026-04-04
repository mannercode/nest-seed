import type { AppTestContext } from 'apps/__tests__/__helpers__'
import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { ShowtimesClient, ShowtimesModule } from 'apps/cores'

export type ShowtimesFixture = AppTestContext & { showtimesClient: ShowtimesClient }

export async function createShowtimesFixture() {
    const ctx = await createAppTestContext({
        imports: [ShowtimesModule],
        providers: [ShowtimesClient]
    })

    const showtimesClient = ctx.module.get(ShowtimesClient)

    return { ...ctx, showtimesClient }
}

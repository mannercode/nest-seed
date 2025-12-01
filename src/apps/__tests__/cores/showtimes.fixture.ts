import { ShowtimesClient, ShowtimesModule } from 'apps/cores'
import { TestFixture, createTestFixture } from '../__helpers__'

export type ShowtimesFixture = TestFixture & { showtimesService: ShowtimesClient }

export async function createShowtimesFixture() {
    const fix = await createTestFixture({
        imports: [ShowtimesModule],
        providers: [ShowtimesClient]
    })

    const showtimesService = fix.module.get(ShowtimesClient)

    return { ...fix, showtimesService }
}

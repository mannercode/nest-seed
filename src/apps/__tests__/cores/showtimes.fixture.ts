import { ShowtimesClient, ShowtimesModule } from 'apps/cores'
import { TestFixture, createTestFixture } from '../__helpers__'

export type Fixture = TestFixture & { showtimesService: ShowtimesClient }

export async function createFixture() {
    const fix = await createTestFixture({
        imports: [ShowtimesModule],
        providers: [ShowtimesClient]
    })

    const showtimesService = fix.module.get(ShowtimesClient)

    return { ...fix, showtimesService }
}

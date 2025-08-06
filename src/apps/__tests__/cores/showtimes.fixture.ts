import { ShowtimesClient, ShowtimesModule } from 'apps/cores'
import { TestFixture, createTestFixture } from '../__helpers__'

export interface Fixture extends TestFixture {
    showtimesService: ShowtimesClient
}

export const createFixture = async () => {
    const fix = await createTestFixture({
        imports: [ShowtimesModule],
        providers: [ShowtimesClient]
    })

    const showtimesService = fix.module.get(ShowtimesClient)

    return { ...fix, showtimesService }
}

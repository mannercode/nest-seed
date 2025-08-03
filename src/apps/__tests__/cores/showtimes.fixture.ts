import { ShowtimesClient, ShowtimesModule } from 'apps/cores'
import { TestFixture, setupTestContext } from '../__helpers__'

export interface ShowtimesFixture extends TestFixture {
    showtimesService: ShowtimesClient
}

export const createFixture = async () => {
    const context = await setupTestContext({
        imports: [ShowtimesModule],
        providers: [ShowtimesClient]
    })

    const showtimesService = context.module.get(ShowtimesClient)

    return { ...context, showtimesService }
}

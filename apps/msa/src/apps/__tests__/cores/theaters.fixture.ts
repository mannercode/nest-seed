import { TheatersClient, TheatersModule } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type TheatersFixture = AppTestContext & {}

export async function createTheatersFixture() {
    const ctx = await createAppTestContext({
        imports: [TheatersModule],
        providers: [TheatersClient]
    })

    return { ...ctx }
}

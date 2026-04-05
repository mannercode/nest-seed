import { TheatersClient, TheatersModule } from 'cores'
import { TheatersHttpController } from 'gateway'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type TheatersFixture = AppTestContext & {}

export async function createTheatersFixture() {
    const ctx = await createAppTestContext({
        controllers: [TheatersHttpController],
        imports: [TheatersModule],
        providers: [TheatersClient]
    })

    return { ...ctx }
}

import { TheatersModule } from 'cores'
import { TheatersHttpController } from 'gateway'
import { createAppTestContext, type AppTestContext } from '../__helpers__'

export type TheatersFixture = AppTestContext & {}

export async function createTheatersFixture() {
    const ctx = await createAppTestContext({
        controllers: [TheatersHttpController],
        imports: [TheatersModule]
    })

    return { ...ctx }
}

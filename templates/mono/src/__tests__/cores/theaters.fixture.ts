import { TheatersHttpController } from 'controllers'
import { TheatersModule } from 'cores'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type TheatersFixture = AppTestContext & {}

export async function createTheatersFixture() {
    const ctx = await createAppTestContext({
        controllers: [TheatersHttpController],
        imports: [TheatersModule]
    })

    return { ...ctx }
}

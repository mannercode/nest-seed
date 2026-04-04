import { TheatersHttpController } from 'controllers'
import { TheatersModule } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type TheatersFixture = AppTestContext & {}

export async function createTheatersFixture() {
    const ctx = await createAppTestContext({
        controllers: [TheatersHttpController],
        imports: [TheatersModule]
    })

    return { ...ctx }
}

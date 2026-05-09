import { TheatersModule } from 'core'
import { TheatersHttpController } from 'gateway'
import { createAppTestContext, type AppTestContext } from '../helpers'

export type TheatersFixture = AppTestContext

export async function createTheatersFixture() {
    return createAppTestContext({
        controllers: [TheatersHttpController],
        imports: [TheatersModule]
    })
}

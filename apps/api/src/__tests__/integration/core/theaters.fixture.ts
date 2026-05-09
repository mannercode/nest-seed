import { createAppTestContext, type AppTestContext } from '../helpers'

export type TheatersFixture = AppTestContext

export async function createTheatersFixture() {
    return createAppTestContext()
}

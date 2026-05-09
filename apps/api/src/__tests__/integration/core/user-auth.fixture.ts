import { type AppTestContext, createAppTestContext } from '../helpers'

export type UserAuthFixture = AppTestContext

export async function createUserAuthFixture() {
    return createAppTestContext()
}

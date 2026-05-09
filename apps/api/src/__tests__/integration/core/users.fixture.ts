import { UserJwtAuthGuard } from 'gateway'
import { createAppTestContext, type AppTestContext } from '../helpers'

export type UsersFixture = AppTestContext

export async function createUsersFixture() {
    return createAppTestContext({ ignoreGuards: [UserJwtAuthGuard] })
}

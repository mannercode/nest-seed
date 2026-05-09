import { UsersModule } from 'core'
import { UserJwtAuthGuard, UsersHttpController } from 'gateway'
import { createAppTestContext, type AppTestContext } from '../helpers'

export type UsersFixture = AppTestContext

export async function createUsersFixture() {
    const ctx = await createAppTestContext({
        controllers: [UsersHttpController],
        ignoreGuards: [UserJwtAuthGuard],
        imports: [UsersModule]
    })

    return ctx
}

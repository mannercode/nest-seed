import { UsersModule } from 'cores'
import { UserJwtAuthGuard, UsersHttpController } from 'gateway'
import { createAppTestContext, type AppTestContext } from '../__helpers__'

export type UsersFixture = AppTestContext & {}

export async function createUsersFixture() {
    const ctx = await createAppTestContext({
        controllers: [UsersHttpController],
        ignoreGuards: [UserJwtAuthGuard],
        imports: [UsersModule]
    })

    return ctx
}

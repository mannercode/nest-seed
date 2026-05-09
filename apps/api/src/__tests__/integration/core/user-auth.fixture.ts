import { UsersModule } from 'core'
import { UserJwtAuthGuard, UserLocalAuthGuard, UsersHttpController } from 'gateway'
import { type AppTestContext, createAppTestContext } from '../helpers'

export type UserAuthFixture = AppTestContext

export async function createUserAuthFixture() {
    return createAppTestContext({
        controllers: [UsersHttpController],
        imports: [UsersModule],
        providers: [UserJwtAuthGuard, UserLocalAuthGuard]
    })
}

import { UsersModule } from 'cores'
import { UserJwtAuthGuard, UserLocalAuthGuard, UsersHttpController } from 'gateway'
import { type AppTestContext, createAppTestContext } from '../__helpers__'

export type UserAuthFixture = AppTestContext

export async function createUserAuthFixture() {
    return createAppTestContext({
        controllers: [UsersHttpController],
        imports: [UsersModule],
        providers: [UserJwtAuthGuard, UserLocalAuthGuard]
    })
}

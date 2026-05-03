import {
    UserJwtAuthGuard,
    UserLocalAuthGuard,
    UserOptionalJwtAuthGuard,
    UsersHttpController
} from 'controllers'
import { UsersModule } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type UserAuthFixture = AppTestContext & {}

export async function createUserAuthFixture() {
    const ctx = await createAppTestContext({
        controllers: [UsersHttpController],
        imports: [UsersModule],
        providers: [UserJwtAuthGuard, UserLocalAuthGuard, UserOptionalJwtAuthGuard]
    })

    return { ...ctx }
}

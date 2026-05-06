import { UsersModule } from 'cores'
import { UserJwtAuthGuard, UserLocalAuthGuard, UsersHttpController } from 'gateway'
import { type AppTestContext, createAppTestContext } from '../__helpers__'

export type UserAuthFixture = AppTestContext & {}

export async function createUserAuthFixture() {
    const ctx = await createAppTestContext({
        controllers: [UsersHttpController],
        imports: [UsersModule],
        providers: [UserJwtAuthGuard, UserLocalAuthGuard]
    })

    return { ...ctx }
}

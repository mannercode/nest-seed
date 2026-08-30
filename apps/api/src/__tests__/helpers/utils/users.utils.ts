import { nullPlainDate, type TestContext } from '@mannercode/testing'
import type { CreateUserDto, UserCredentialsDto } from '#core'

export function buildCreateUserDto(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
    return {
        birthDate: nullPlainDate,
        email: 'name@mail.com',
        name: 'name',
        password: 'password',
        ...overrides
    }
}

export async function createAndLoginUser(ctx: TestContext) {
    const credentials = { email: 'user@mail.com', password: 'password' }

    const user = await createUser(ctx, credentials)

    const { accessToken, refreshToken } = await loginUser(ctx, credentials)

    return { accessToken, user, refreshToken }
}

export async function createUser(ctx: TestContext, override: Partial<CreateUserDto> = {}) {
    const { UsersService } = await import('#core')
    const usersService = ctx.module.get(UsersService)

    const createDto = buildCreateUserDto(override)

    const user = await usersService.create(createDto)
    return user
}

export async function loginUser(ctx: TestContext, credentials: UserCredentialsDto) {
    const { UsersService } = await import('#core')
    const usersService = ctx.module.get(UsersService)

    const result = await usersService.login(credentials)
    if (!result) {
        throw new Error(`loginUser: no user found for credentials (email=${credentials.email})`)
    }

    const { accessToken, refreshToken } = result.tokens

    return { accessToken, user: result.user, refreshToken }
}

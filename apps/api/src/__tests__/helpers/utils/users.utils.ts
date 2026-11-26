import type { JwtAuthTokens } from '@mannercode/common'
import { nullPlainDate } from '@mannercode/testing'
import type { AppTestContext } from '#test-helpers'
import { type CreateUserDto, type UserCredentialsDto, UserSchema } from '#core'

export function buildCreateUserDto(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
    return {
        birthDate: nullPlainDate,
        email: 'name@mail.com',
        name: 'name',
        password: 'Example password 1!',
        ...overrides
    }
}

export async function createAndLoginUser(ctx: AppTestContext) {
    const credentials = { email: 'user@mail.com', password: 'Example password 1!' }

    await createUser(ctx, credentials)
    return loginUser(ctx, credentials)
}

export async function createUser(ctx: AppTestContext, override: Partial<CreateUserDto> = {}) {
    const { body } = await ctx.httpClient
        .post('/users')
        .body(buildCreateUserDto(override))
        .created({ schema: UserSchema })
    return body
}

export async function loginUser(ctx: AppTestContext, credentials: UserCredentialsDto) {
    const { body: tokens } = await ctx.httpClient
        .post('/users/login')
        .body(credentials)
        .ok<JwtAuthTokens>()
    const { body: user } = await ctx.httpClient
        .get('/users/me')
        .headers({ Authorization: 'Bearer ' + tokens.accessToken })
        .ok({ schema: UserSchema })
    return { ...tokens, user }
}

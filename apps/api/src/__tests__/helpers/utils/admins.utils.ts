import type { TestContext } from '@mannercode/testing'
import type { AdminCredentialsDto, CreateAdminDto } from 'core'

export function buildCreateAdminDto(overrides: Partial<CreateAdminDto> = {}): CreateAdminDto {
    return { email: 'admin@mail.com', name: 'admin', password: 'password', ...overrides }
}

export async function createAndLoginAdmin(ctx: TestContext) {
    const credentials = { email: 'admin@mail.com', password: 'password' }

    const admin = await createAdmin(ctx, credentials)
    const { accessToken, refreshToken } = await loginAdmin(ctx, credentials)

    return { accessToken, admin, refreshToken }
}

export async function createAdmin(ctx: TestContext, override: Partial<CreateAdminDto> = {}) {
    const { AdminsService } = await import('core')
    const adminsService = ctx.module.get(AdminsService)

    const createDto = buildCreateAdminDto(override)

    const admin = await adminsService.create(createDto)
    return admin
}

export async function loginAdmin(ctx: TestContext, credentials: AdminCredentialsDto) {
    const { AdminsService } = await import('core')
    const adminsService = ctx.module.get(AdminsService)

    const admin = await adminsService.findAdminByCredentials(credentials)
    if (!admin) {
        throw new Error(`loginAdmin: no admin found for credentials (email=${credentials.email})`)
    }

    const { accessToken, refreshToken } = await adminsService.generateAuthTokens({
        sub: admin.id,
        email: credentials.email
    })

    return { accessToken, admin, refreshToken }
}

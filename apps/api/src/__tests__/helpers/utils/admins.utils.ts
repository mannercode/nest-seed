import type { TestContext } from '@mannercode/testing'
import { ensure, MongoConnection } from '@mannercode/common'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { AppConfigService } from '#config'
import { type AdminCredentialsDto, type CreateAdminDto, AdminsService } from '#core'

export function buildCreateAdminDto(overrides: Partial<CreateAdminDto> = {}): CreateAdminDto {
    return { email: 'admin@mail.com', name: 'admin', password: 'Example password 1!', ...overrides }
}

export async function createAndLoginAdmin(ctx: TestContext) {
    const credentials = { email: 'admin@mail.com', password: 'Example password 1!' }

    const admin = await createAdmin(ctx, credentials)
    const { accessToken, refreshToken } = await loginAdmin(ctx, credentials)

    return { accessToken, admin, refreshToken }
}

export async function createAdmin(ctx: TestContext, override: Partial<CreateAdminDto> = {}) {
    const adminsService = ctx.module.get(AdminsService)

    const createDto = buildCreateAdminDto(override)

    const admin = await adminsService.create(createDto)
    return admin
}

export async function loginAdmin(ctx: TestContext, credentials: AdminCredentialsDto) {
    const adminsService = ctx.module.get(AdminsService)

    const result = await adminsService.login(credentials)
    if (!result) {
        throw new Error(`loginAdmin: no admin found for credentials (email=${credentials.email})`)
    }

    const { accessToken, refreshToken } = result.tokens

    return { accessToken, admin: result.admin, refreshToken }
}

export function runAdminCreateScript(ctx: TestContext, admin: CreateAdminDto) {
    const { uri } = ctx.module.get(AppConfigService).mongo
    const dbName = ctx.module.get(MongoConnection).db.databaseName
    const scriptPath = fileURLToPath(
        new URL('../../../../scripts/admin-create.cjs', import.meta.url)
    )

    return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
        const child = execFile(
            process.execPath,
            [scriptPath],
            { env: { ...process.env, MONGO_URI: uri, MONGO_DATABASE: dbName } },
            (error, stdout, stderr) => {
                if (error && typeof error.code !== 'number') {
                    reject(error)
                    return
                }
                resolve({ exitCode: error ? Number(error.code) : 0, stdout, stderr })
            }
        )
        ensure(child.stdin).end(`${admin.email}\n${admin.name}\n${admin.password}\n`)
    })
}

import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AdminsModule, AdminsService, CreateAdminSchema } from '#core'
import { AppConfigModule, GlobalModule } from './modules/index.js'

@Module({ imports: [AppConfigModule, GlobalModule, AdminsModule] })
class AdminCreateModule {}

async function createAdmin() {
    const app = await NestFactory.createApplicationContext(AdminCreateModule, { logger: false })

    try {
        const createDto = CreateAdminSchema.parse({
            email: requiredEnvironment('ADMIN_EMAIL'),
            name: requiredEnvironment('ADMIN_NAME'),
            password: requiredEnvironment('ADMIN_PASSWORD')
        })
        const admin = await app.get(AdminsService).create(createDto)
        console.log(`Admin created: ${admin.email}`)
    } finally {
        await app.close()
    }
}

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be defined.`)
    return value
}

createAdmin().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
})

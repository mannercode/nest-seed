import { INestApplication } from '@nestjs/common'
import { TestingModule } from '@nestjs/testing'
import { ModuleMetadataEx, createTestingModule } from './create-testing-module'
import { getAvailablePort } from './utils'

export interface TestContext {
    module: TestingModule
    app: INestApplication<any>
    port: number
    close: () => Promise<void>
}

async function listen(server: any) {
    let tryCount = 0

    while (true) {
        try {
            const port = await getAvailablePort()

            await server.listen(port)

            return port
        } catch (error) {
            tryCount = tryCount + 1

            if (3 <= tryCount) throw error
        }
    }
}

export async function createTestContext(
    metadata: ModuleMetadataEx,
    servers: string[],
    configureApp: (app: INestApplication<any>, servers: string[]) => Promise<void>
) {
    const module = await createTestingModule(metadata)

    const app = module.createNestApplication()

    await configureApp(app, servers)

    const isDebuggingEnabled = process.env.NODE_OPTIONS !== undefined
    app.useLogger(isDebuggingEnabled ? console : false)

    await app.init()

    const server = app.getHttpServer()

    const port = await listen(server)

    const close = async () => {
        await app.close()
    }

    return { module, app, port, close } as TestContext
}

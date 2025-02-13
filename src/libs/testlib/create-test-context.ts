import { INestApplication } from '@nestjs/common'
import { TestingModule } from '@nestjs/testing'
import { ModuleMetadataEx, createTestingModule } from './create-testing-module'
import { getAvailablePort } from './utils'

async function listenOnAvailablePort(server: any): Promise<number> {
    const maxAttempts = 3
    let attemptCount = 0

    while (true) {
        try {
            const port = await getAvailablePort()
            await server.listen(port)
            return port
        } catch (error) {
            attemptCount++
            if (attemptCount >= maxAttempts) throw error
        }
    }
}

export interface TestContext {
    module: TestingModule
    app: INestApplication<any>
    httpPort: number
    close: () => Promise<void>
}

export interface TestContextArgs {
    metadata: ModuleMetadataEx
    brokers?: string[]
    configureApp?: (app: INestApplication<any>, brokers: string[] | undefined) => Promise<void>
}

export async function createTestContext({
    metadata,
    brokers,
    configureApp
}: TestContextArgs): Promise<TestContext> {
    const module = await createTestingModule(metadata)
    const app = module.createNestApplication()

    if (configureApp) await configureApp(app, brokers)

    const isDebuggingEnabled = process.env.NODE_OPTIONS !== undefined
    app.useLogger(isDebuggingEnabled ? console : false)

    await app.init()

    const httpServer = app.getHttpServer()
    const httpPort = await listenOnAvailablePort(httpServer)

    const close = () => app.close()

    return { module, app, httpPort, close }
}

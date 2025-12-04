import { INestApplication } from '@nestjs/common'
import { TestingModule } from '@nestjs/testing'
import { Server } from 'http'
import { ModuleMetadataEx, createTestingModule } from './create-testing-module'
import { HttpTestClient } from './http.test-client'
import { getAvailablePort, isDebuggingEnabled } from './utils'

async function listenOnAvailablePort(server: Server): Promise<number> {
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

export type TestContext = {
    module: TestingModule
    app: INestApplication<Server>
    close: () => Promise<void>
}

export type HttpTestContext = TestContext & { httpClient: HttpTestClient }

export type TestContextOptions = {
    metadata: ModuleMetadataEx
    brokers?: string[]
    configureApp?: (app: INestApplication<Server>, brokers: string[] | undefined) => Promise<void>
}

export async function createTestContext({
    metadata,
    brokers,
    configureApp
}: TestContextOptions): Promise<TestContext> {
    const module = await createTestingModule(metadata)
    const app = module.createNestApplication()

    if (configureApp) {
        await configureApp(app, brokers)
    }

    app.useLogger(isDebuggingEnabled ? console : false)

    await app.init()

    async function close() {
        await app.close()
    }

    return { module, app, close }
}

export async function createHttpTestContext(options: TestContextOptions): Promise<HttpTestContext> {
    const testContext = await createTestContext(options)

    const httpServer = testContext.app.getHttpServer()
    const httpPort = await listenOnAvailablePort(httpServer)
    const httpClient = new HttpTestClient(httpPort)

    return { ...testContext, httpClient }
}

import express from 'express'
import { INestApplication } from '@nestjs/common'
import { TestingModule } from '@nestjs/testing'
import { ModuleMetadataEx, createTestingModule } from './create-testing-module'
import { getAvailablePort } from './utils'
import { HttpTestClient } from './http.test-client'

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
    close: () => Promise<void>
}

export interface HttpTestContext extends TestContext {
    httpClient: HttpTestClient
}

export interface TestContextOptions {
    metadata: ModuleMetadataEx
    brokers?: string[]
    configureApp?: (app: INestApplication<any>, brokers: string[] | undefined) => Promise<void>
}

export async function createTestContext({
    metadata,
    brokers,
    configureApp
}: TestContextOptions): Promise<TestContext> {
    const module = await createTestingModule(metadata)
    const app = module.createNestApplication()

    await configureApp?.(app, brokers)

    const isDebuggingEnabled = process.env.NODE_OPTIONS !== undefined
    app.useLogger(isDebuggingEnabled ? console : false)

    await app.init()

    const close = () => app.close()

    return { module, app, close }
}

export async function createHttpTestContext(options: TestContextOptions): Promise<HttpTestContext> {
    const testContext = await createTestContext({
        ...options,
        configureApp: async (app) => {
            app.use(express.urlencoded({ extended: true }))

            await options.configureApp?.(app, options.brokers)
        }
    })

    const httpServer = testContext.app.getHttpServer()
    const httpPort = await listenOnAvailablePort(httpServer)
    const httpClient = new HttpTestClient(httpPort)

    return { ...testContext, httpClient }
}

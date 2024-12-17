import { INestApplication } from '@nestjs/common'
import { TestingModule } from '@nestjs/testing'
import express from 'express'
import { ModuleMetadataEx, createTestingModule } from './create-testing-module'
import { HttpTestClient } from './http.test-client'
import { getAvailablePort } from './utils'

export interface HttpTestContext {
    server: any
    module: TestingModule
    app: INestApplication<any>
    client: HttpTestClient
    close: () => Promise<void>
}

async function listen(server: any) {
    let tryCount = 0

    while (true) {
        try {
            const port = await getAvailablePort()
            // const port =3000
            await server.listen(port)

            return port
        } catch (error) {
            tryCount = tryCount + 1

            if (3 <= tryCount) throw error
        }
    }
}

export async function createHttpTestContext(
    metadata: ModuleMetadataEx,
    configureApp?: (app: INestApplication<any>) => void
) {
    const module = await createTestingModule(metadata)

    const app = module.createNestApplication()

    configureApp && configureApp(app)

    const isDebuggingEnabled = process.env.NODE_OPTIONS !== undefined
    app.useLogger(isDebuggingEnabled ? console : false)

    if (process.env.HTTP_REQUEST_PAYLOAD_LIMIT) {
        const limit = process.env.HTTP_REQUEST_PAYLOAD_LIMIT

        app.use(express.json({ limit }))
        app.use(express.urlencoded({ limit, extended: true }))
    }

    await app.init()

    const server = app.getHttpServer()

    let port = await listen(server)

    const client = new HttpTestClient(`http://localhost:${port}`)

    const close = async () => {
        await app.close()
    }

    return { server, module, app, client, close } as HttpTestContext
}

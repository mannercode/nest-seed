import { INestApplication } from '@nestjs/common'
import { TestingModule } from '@nestjs/testing'
import * as express from 'express'
import { ModuleMetadataEx, createTestingModule } from './create-testing-module'
import { HttpTestClient } from './http.test-client'
import { addAppLogger, getAvailablePort } from './utils'

export interface HttpTestContext {
    server: any
    module: TestingModule
    app: INestApplication<any>
    client: HttpTestClient
    close: () => Promise<void>
}

export async function createHttpTestContext(metadata: ModuleMetadataEx): Promise<HttpTestContext> {
    const module = await createTestingModule(metadata)

    const app = module.createNestApplication()
    addAppLogger(app)

    if (process.env.HTTP_REQUEST_PAYLOAD_LIMIT) {
        const limit = process.env.HTTP_REQUEST_PAYLOAD_LIMIT

        app.use(express.json({ limit }))
        app.use(express.urlencoded({ limit, extended: true }))
    }

    await app.init()

    const server = app.getHttpServer()

    const port = await getAvailablePort()
    await server.listen(port)

    const client = new HttpTestClient(server)

    const close = async () => {
        await app.close()
    }

    return { server, module, app, client, close }
}

import { INestMicroservice } from '@nestjs/common'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { TestingModule } from '@nestjs/testing'
import { createTestingModule, ModuleMetadataEx } from './create-testing-module'
import { MicroserviceTestClient } from './microservice.test-client'
import { getAvailablePort } from './utils'

export interface MicroserviceTestContext {
    module: TestingModule
    app: INestMicroservice
    client: MicroserviceTestClient
    close: () => Promise<void>
    port: number
}

async function startMicroservice(
    module: TestingModule,
    configureApp?: (app: INestMicroservice) => void
) {
    let tryCount = 0

    while (true) {
        try {
            const port = await getAvailablePort()
            const rpcOptions = {
                transport: Transport.TCP,
                options: { host: '0.0.0.0', port }
            } as const

            const app = module.createNestMicroservice<MicroserviceOptions>(rpcOptions)
            if (configureApp) await configureApp(app)

            const isDebuggingEnabled = process.env.NODE_OPTIONS !== undefined
            app.useLogger(isDebuggingEnabled ? console : false)

            await app.listen()

            return { app, port, rpcOptions }
        } catch (error) {
            tryCount = tryCount + 1

            if (3 <= tryCount) throw error
        }
    }
}

export async function createMicroserviceTestContext(
    metadata: ModuleMetadataEx,
    configureApp?: (app: INestMicroservice) => void
) {
    const module = await createTestingModule(metadata)

    const { app, port, rpcOptions } = await startMicroservice(module, configureApp)

    const client = await MicroserviceTestClient.create(rpcOptions)

    const close = async () => {
        await client.close()
        await app.close()
    }

    return { module, app, close, client, port } as MicroserviceTestContext
}

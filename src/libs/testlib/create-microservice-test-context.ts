import { INestMicroservice } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import { TestingModule } from '@nestjs/testing'
import { createTestingModule, ModuleMetadataEx } from './create-testing-module'
import { MicroserviceTestClient } from './microservice.test-client'

export interface MicroserviceTestContext {
    module: TestingModule
    app: INestMicroservice
    client: MicroserviceTestClient
    close: () => Promise<void>
}

export async function createMicroserviceTestContext({
    metadata,
    nats,
    configureApp
}: {
    metadata: ModuleMetadataEx
    nats: { servers: string[] }
    configureApp?: (app: INestMicroservice) => void
}) {
    const module = await createTestingModule(metadata)

    const rpcOptions = {
        transport: Transport.NATS,
        options: { servers: nats.servers }
    } as const

    const app = module.createNestMicroservice(rpcOptions)

    if (configureApp) await configureApp(app)

    const isDebuggingEnabled = process.env.NODE_OPTIONS !== undefined
    app.useLogger(isDebuggingEnabled ? console : false)

    await app.listen()

    const client = await MicroserviceTestClient.create(rpcOptions)

    const close = async () => {
        await client.close()
        await app.close()
    }

    return { module, app, close, client } as MicroserviceTestContext
}

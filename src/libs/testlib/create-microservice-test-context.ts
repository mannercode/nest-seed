import { INestMicroservice } from '@nestjs/common'
import { NatsOptions, Transport } from '@nestjs/microservices'
import { TestingModule } from '@nestjs/testing'
import { createTestingModule, ModuleMetadataEx } from './create-testing-module'
import { MicroserviceTestClient } from './microservice.test-client'
import { getNatsTestConnection } from './test-containers'

export interface MicroserviceTestContext {
    module: TestingModule
    app: INestMicroservice
    client: MicroserviceTestClient
    close: () => Promise<void>
}

export async function createMicroserviceTestContext(
    metadata: ModuleMetadataEx,
    configureApp?: (app: INestMicroservice) => void
) {
    const module = await createTestingModule(metadata)

    const { servers } = getNatsTestConnection()

    const rpcOptions: NatsOptions = {
        transport: Transport.NATS,
        options: { servers, queue: 'test-queue' }
    }

    const app = module.createNestMicroservice<NatsOptions>(rpcOptions)
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

import { INestMicroservice } from '@nestjs/common'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { TestingModule } from '@nestjs/testing'
import { HttpToRpcExceptionFilter } from 'common'
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

export async function createMicroserviceTestContext(metadata: ModuleMetadataEx) {
    const module = await createTestingModule(metadata)

    const port = await getAvailablePort()
    const rpcOptions = {
        transport: Transport.TCP,
        options: { host: '0.0.0.0', port }
    } as const

    const app = module.createNestMicroservice<MicroserviceOptions>(rpcOptions)

    const isDebuggingEnabled = process.env.NODE_OPTIONS !== undefined
    app.useLogger(isDebuggingEnabled ? console : false)

    app.useGlobalFilters(new HttpToRpcExceptionFilter())

    await app.listen()

    const client = await MicroserviceTestClient.create(rpcOptions)

    const close = async () => {
        await client.close()
        await app.close()
    }

    return { module, app, close, client, port } as MicroserviceTestContext
}

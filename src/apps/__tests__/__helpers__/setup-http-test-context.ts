import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import compression from 'compression'
import express from 'express'
import { AppConfigService, CommonModule, MongooseConfigModule, RedisConfigModule } from 'shared'
import {
    createHttpTestContext,
    createTestContext,
    getNatsTestConnection,
    HttpTestContext,
    ModuleMetadataEx,
    TestContext
} from 'testlib'

export interface HttpTestFixture extends HttpTestContext {
    teardown: () => Promise<void>
}

export const setupHttpTestContext = async (metadata: ModuleMetadataEx) => {
    metadata.imports?.push(CommonModule, MongooseConfigModule, RedisConfigModule)

    const context = await createHttpTestContext({
        metadata,
        configureApp: async (app) => {
            const config = app.get(AppConfigService)

            app.use(compression())
            app.use(express.json({ limit: config.http.requestPayloadLimit }))

            const { servers } = await getNatsTestConnection()

            app.connectMicroservice<MicroserviceOptions>(
                { transport: Transport.NATS, options: { servers, queue: process.env.TEST_ID } },
                { inheritAppConfig: true }
            )

            await app.startAllMicroservices()
        }
    })

    const teardown = async () => {
        await context.close()

        const redis = context.module.get(RedisConfigModule.moduleName)
        await redis.quit()
    }

    return { ...context, teardown }
}

export interface TestFixture extends TestContext {
    teardown: () => Promise<void>
}

export const setupTestContext = async (metadata: ModuleMetadataEx) => {
    metadata.imports?.push(CommonModule, MongooseConfigModule, RedisConfigModule)

    const context = await createTestContext({
        metadata,
        configureApp: async (app) => {
            const { servers } = await getNatsTestConnection()

            app.connectMicroservice<MicroserviceOptions>(
                { transport: Transport.NATS, options: { servers, queue: process.env.TEST_ID } },
                { inheritAppConfig: true }
            )

            await app.startAllMicroservices()
        }
    })

    const teardown = async () => {
        await context.close()

        const redis = context.module.get(RedisConfigModule.moduleName)
        await redis.quit()
    }

    return { ...context, teardown }
}

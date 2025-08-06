import { ConfigService } from '@nestjs/config'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import compression from 'compression'
import express from 'express'
import { AppConfigService, CommonModule, MongooseConfigModule, RedisConfigModule } from 'shared'
import {
    createHttpTestContext,
    getNatsTestConnection,
    HttpTestContext,
    ModuleMetadataEx
} from 'testlib'

export interface TestFixture extends HttpTestContext {
    teardown: () => Promise<void>
}

export const createTestFixture = async (metadata: ModuleMetadataEx) => {
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

export const createConfigServiceMock = (mockValues: Record<string, any>) => {
    const realConfigService = new ConfigService()

    return {
        original: ConfigService,
        replacement: {
            get: jest.fn((key: string) =>
                key in mockValues ? mockValues[key] : realConfigService.get(key)
            )
        }
    }
}

import { BullModule } from '@nestjs/bullmq'
import { ConfigService } from '@nestjs/config'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import compression from 'compression'
import express from 'express'
import Redis from 'ioredis'
import { AppConfigService, CommonModule, MongooseConfigModule, RedisConfigModule } from 'shared'
import {
    createHttpTestContext,
    getNatsTestConnection,
    getTestId,
    HttpTestContext,
    ModuleMetadataEx
} from 'testlib'

export type TestFixture = HttpTestContext & { teardown: () => Promise<void> }

export async function createTestFixture(metadata: ModuleMetadataEx) {
    metadata.imports?.push(
        CommonModule,
        MongooseConfigModule,
        RedisConfigModule,
        BullModule.forRootAsync('queue', {
            useFactory(redis: Redis) {
                return { prefix: `{queue:${getTestId()}}`, connection: redis }
            },
            inject: [RedisConfigModule.moduleName]
        })
    )

    const context = await createHttpTestContext({
        metadata,
        configureApp: async (app) => {
            const config = app.get(AppConfigService)

            app.use(compression())
            app.use(express.json({ limit: config.http.requestPayloadLimit }))

            const { servers } = await getNatsTestConnection()

            app.connectMicroservice<MicroserviceOptions>(
                { transport: Transport.NATS, options: { servers, queue: getTestId() } },
                { inheritAppConfig: true }
            )

            await app.startAllMicroservices()
        }
    })

    async function teardown() {
        await context.close()

        const redis = context.module.get(RedisConfigModule.moduleName)
        await redis.quit()
    }

    return { ...context, teardown }
}

export function createConfigServiceMock(mockValues: Record<string, any>) {
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

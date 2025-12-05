import { BullModule } from '@nestjs/bullmq'
import { ConfigService } from '@nestjs/config'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import compression from 'compression'
import express from 'express'
import Redis from 'ioredis'
import {
    AppConfigService,
    CommonModule,
    getProjectId,
    MongooseConfigModule,
    RedisConfigModule
} from 'shared'
import { createHttpTestContext, HttpTestContext, ModuleMetadataEx } from 'testlib'

export type TestFixture = HttpTestContext & { teardown: () => Promise<void> }

export async function createTestFixture(metadata: ModuleMetadataEx) {
    metadata.imports?.push(
        CommonModule,
        MongooseConfigModule,
        RedisConfigModule,
        BullModule.forRootAsync('queue', {
            useFactory(redis: Redis) {
                return { prefix: `{queue:${getProjectId()}}`, connection: redis }
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

            app.connectMicroservice<MicroserviceOptions>(
                {
                    transport: Transport.NATS,
                    options: { servers: config.nats.servers, queue: getProjectId() }
                },
                { inheritAppConfig: true }
            )

            await app.startAllMicroservices()
            // This prevents the following error:
            // Empty response. There are no subscribers listening to that message
            await app.init()
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

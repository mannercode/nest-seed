import { BullModule } from '@nestjs/bullmq'
import { ConfigService } from '@nestjs/config'
import type { MicroserviceOptions } from '@nestjs/microservices'
import { Transport } from '@nestjs/microservices'
import { AppLoggerService } from 'common'
import compression from 'compression'
import express from 'express'
import type Redis from 'ioredis'
import {
    AppConfigService,
    CommonModule,
    getProjectId,
    MongooseConfigModule,
    RedisConfigModule
} from 'shared'
import type { HttpTestContext, ModuleMetadataEx } from 'testlib'
import { createHttpTestContext, isDebuggingEnabled } from 'testlib'

export type AppTestContext = HttpTestContext & { teardown: () => Promise<void> }

export async function createAppTestContext(metadata: ModuleMetadataEx) {
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

    const ctx = await createHttpTestContext({
        configureApp: async (app) => {
            const { http, nats } = app.get(AppConfigService)

            app.use(compression())
            app.use(express.json({ limit: http.requestPayloadLimit }))

            app.connectMicroservice<MicroserviceOptions>(
                {
                    transport: Transport.NATS,
                    options: { servers: nats.servers, queue: getProjectId() }
                },
                { inheritAppConfig: true }
            )

            if (isDebuggingEnabled()) {
                const logger = app.get(AppLoggerService)
                app.useLogger(logger)
            }

            await app.startAllMicroservices()
        },
        ...metadata
    })

    const teardown = async () => {
        await ctx.close()

        const redis = ctx.module.get(RedisConfigModule.moduleName)
        await redis.quit()
    }

    return { ...ctx, teardown }
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

// const configMock = createConfigServiceMock({
//     FILE_UPLOAD_MAX_FILE_SIZE_BYTES: localFiles.oversized.size,
//     FILE_UPLOAD_MAX_FILES_PER_UPLOAD: maxFilesPerUpload,
//     FILE_UPLOAD_ALLOWED_FILE_TYPES: 'text/plain',
//     S3_ENDPOINT: s3.endpoint,
//     S3_REGION: s3.region,
//     S3_BUCKET: s3.bucket,
//     S3_ACCESS_KEY_ID: s3.accessKeyId,
//     S3_SECRET_ACCESS_KEY: s3.secretAccessKey,
//     S3_FORCE_PATH_STYLE: s3.forcePathStyle
// })

// const ctx = await createAppTestContext({
//     imports: [AssetsModule],
//     providers: [AssetsClient],
//     overrideProviders: [configMock]
// })

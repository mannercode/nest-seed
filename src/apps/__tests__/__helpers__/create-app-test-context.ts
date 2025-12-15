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
        },
        ...metadata
    })

    async function teardown() {
        await ctx.close()

        const redis = ctx.module.get(RedisConfigModule.moduleName)
        await redis.quit()
    }

    return { ...ctx, teardown }
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

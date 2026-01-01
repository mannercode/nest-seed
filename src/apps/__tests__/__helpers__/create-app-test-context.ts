import { BullModule } from '@nestjs/bullmq'
import { ConfigService } from '@nestjs/config'
import { Transport } from '@nestjs/microservices'
import { SchedulerRegistry } from '@nestjs/schedule'
import { AppLoggerService } from 'common'
import compression from 'compression'
import express from 'express'
import {
    AppConfigService,
    CommonModule,
    getProjectId,
    MongooseConfigModule,
    RedisConfigModule
} from 'shared'
import { createHttpTestContext, isDebuggingEnabled } from 'testlib'
import type { MicroserviceOptions } from '@nestjs/microservices'
import type Redis from 'ioredis'
import type { HttpTestContext, ModuleMetadataEx } from 'testlib'

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

            if (isDebuggingEnabled()) {
                const logger = app.get(AppLoggerService)
                app.useLogger(logger)
            }

            app.connectMicroservice<MicroserviceOptions>(
                {
                    transport: Transport.NATS,
                    options: {
                        servers: nats.servers,
                        queue: getProjectId(),
                        // TODO
                        // 연결/재연결 안정화 (옵션들은 Nest NatsOptions에 존재)
                        waitOnFirstConnect: true
                        // reconnect: true,
                        // maxReconnectAttempts: -1,
                        // reconnectTimeWait: 1000,
                        // reconnectJitter: 100
                    }
                },
                { inheritAppConfig: true }
            )

            await app.startAllMicroservices()
        },
        ...metadata
    })

    await stopAllCronJobs(ctx)

    const teardown = async () => {
        await ctx.close()

        const redis = ctx.module.get(RedisConfigModule.moduleName)
        await redis.quit()
    }

    return { ...ctx, teardown }
}

async function stopAllCronJobs(ctx: HttpTestContext) {
    const scheduler = ctx.module.get(SchedulerRegistry)

    const cronJobs = scheduler.getCronJobs()

    for (const [_name, job] of cronJobs.entries()) {
        await job.stop()
    }
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
//     S3_ENDPOINT: s3.endpoint,
//     S3_REGION: s3.region,
//     S3_BUCKET: s3.bucket,
//     S3_ACCESS_KEY: s3.accessKeyId,
//     S3_SECRET_KEY: s3.secretAccessKey,
//     S3_FORCE_PATH_STYLE: s3.forcePathStyle
// })

// const ctx = await createAppTestContext({
//     imports: [AssetsModule],
//     providers: [AssetsClient],
//     overrideProviders: [configMock]
// })

import type { QueueOptions } from 'bullmq'
import type Redis from 'ioredis'
import { AppLoggerService } from '@mannercode/common'
import {
    createHttpTestContext,
    isDebuggingEnabled,
    HttpTestContext,
    ModuleMetadataEx
} from '@mannercode/testing'
import { BullModule } from '@nestjs/bullmq'
import { ConfigService } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { SchedulerRegistry } from '@nestjs/schedule'
import compression from 'compression'
import {
    AppConfigService,
    CommonModule,
    getProjectId,
    MongooseConfigModule,
    RedisConfigModule
} from 'config'
import express from 'express'

export type AppTestContext = HttpTestContext & { teardown: () => Promise<void> }

export async function createAppTestContext(metadata: ModuleMetadataEx) {
    metadata.imports?.push(
        CommonModule,
        MongooseConfigModule,
        RedisConfigModule,
        EventEmitterModule.forRoot(),
        BullModule.forRootAsync('queue', {
            inject: [RedisConfigModule.moduleName],
            useFactory(redis: Redis) {
                return {
                    connection: redis as unknown as QueueOptions['connection'],
                    prefix: `{queue:${getProjectId()}}`
                }
            }
        })
    )

    const ctx = await createHttpTestContext({
        configureApp: async (app) => {
            const { http } = app.get(AppConfigService)

            app.use(compression())
            app.use(express.json({ limit: http.requestPayloadLimit }))

            if (isDebuggingEnabled()) {
                const logger = app.get(AppLoggerService)
                app.useLogger(logger)
            }
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

/**
 * @example
 * const configMock = createConfigServiceMock({ S3_ENDPOINT: s3.endpoint })
 * const ctx = await createAppTestContext({
 *     imports: [AssetsModule],
 *     providers: [],
 *     overrideProviders: [configMock]
 * })
 */
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

async function stopAllCronJobs(ctx: HttpTestContext) {
    const scheduler = ctx.module.get(SchedulerRegistry)

    const cronJobs = scheduler.getCronJobs()

    for (const [_name, job] of cronJobs.entries()) {
        await job.stop()
    }
}

import { AppLoggerService } from '@mannercode/common'
import {
    createHttpTestContext,
    isDebuggingEnabled,
    type HttpTestContext,
    type ModuleMetadataEx
} from '@mannercode/testing'
import { ConfigService } from '@nestjs/config'
import { SchedulerRegistry } from '@nestjs/schedule'
import compression from 'compression'
import {
    AppConfigService,
    CommonModule,
    MongooseConfigModule,
    NatsConfigModule,
    RedisConfigModule,
    TemporalConfigModule
} from 'config'
import express from 'express'

export async function createAppTestContext(metadata: ModuleMetadataEx) {
    metadata.imports?.push(
        CommonModule,
        MongooseConfigModule,
        RedisConfigModule,
        NatsConfigModule,
        TemporalConfigModule
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

export type AppTestContext = Awaited<ReturnType<typeof createAppTestContext>>

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

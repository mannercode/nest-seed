import type { HttpTestContext, ModuleMetadataEx } from '@mannercode/nest-testing'
import type { MicroserviceOptions } from '@nestjs/microservices'
import { AppLoggerService } from '@mannercode/nest-common'
import { TemporalClientModule } from '@mannercode/nest-microservice'
import { createHttpTestContext, isDebuggingEnabled } from '@mannercode/nest-testing'
import { ConfigService } from '@nestjs/config'
import { Transport } from '@nestjs/microservices'
import { SchedulerRegistry } from '@nestjs/schedule'
import {
    AppConfigService,
    CommonModule,
    getProjectId,
    MongooseConfigModule,
    RedisConfigModule
} from 'app-common'
import compression from 'compression'
import express from 'express'

export type AppTestContext = HttpTestContext & { teardown: () => Promise<void> }

export async function createAppTestContext(metadata: ModuleMetadataEx) {
    metadata.imports?.push(
        CommonModule,
        MongooseConfigModule,
        RedisConfigModule,
        TemporalClientModule.registerAsync({
            inject: [AppConfigService],
            useFactory: (config: AppConfigService) => config.temporal
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
                    options: { queue: getProjectId(), servers: nats.servers },
                    transport: Transport.NATS
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

/**
 * @example
 * const configMock = createConfigServiceMock({ S3_ENDPOINT: s3.endpoint })
 * const ctx = await createAppTestContext({
 *     imports: [AssetsModule],
 *     providers: [AssetsClient],
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

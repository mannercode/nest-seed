import { AppLoggerService } from '@mannercode/common'
import {
    createHttpTestContext,
    isDebuggingEnabled,
    type HttpTestContext,
    type ModuleMetadataEx
} from '@mannercode/testing'
import { SchedulerRegistry } from '@nestjs/schedule'
import compression from 'compression'
import { AppConfigService } from 'config'
import express from 'express'
import { AppModule } from '../../app.module'

export async function createAppTestContext(metadata: ModuleMetadataEx = {}) {
    const imports = [AppModule, ...(metadata.imports ?? [])]

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
        ...metadata,
        imports
    })

    await stopAllCronJobs(ctx)

    // 연결 정리는 각 모듈의 ConnectionRegistry가 onModuleDestroy에서 책임지므로 close만 부른다.
    const teardown = async () => {
        await ctx.close()
    }

    return { ...ctx, teardown }
}

export type AppTestContext = Awaited<ReturnType<typeof createAppTestContext>>

async function stopAllCronJobs(ctx: HttpTestContext) {
    const scheduler = ctx.module.get(SchedulerRegistry)

    const cronJobs = scheduler.getCronJobs()

    for (const [_name, job] of cronJobs.entries()) {
        await job.stop()
    }
}

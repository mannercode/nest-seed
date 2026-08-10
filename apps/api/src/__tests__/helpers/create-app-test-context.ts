import { AppLoggerService } from '@mannercode/common'
import {
    createHttpTestContext,
    isDebuggingEnabled,
    type HttpTestContext,
    type ModuleMetadataEx
} from '@mannercode/testing'
import { getConnectionToken } from '@nestjs/mongoose'
import { SchedulerRegistry } from '@nestjs/schedule'
import compression from 'compression'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import express from 'express'
import { getSharedTestMongooseConnection } from '../../../scripts'
import { AppModule } from '../../app.module'

export async function createAppTestContext(metadata: ModuleMetadataEx = {}) {
    const imports = [AppModule, ...(metadata.imports ?? [])]
    const sharedMongo = getSharedTestMongooseConnection()
    const overrideProviders = [
        {
            original: getConnectionToken(MONGO_CONNECTION_NAME),
            replacement: sharedMongo.connection
        },
        ...(metadata.overrideProviders ?? [])
    ]

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
        imports,
        overrideProviders
    })

    try {
        await stopAllCronJobs(ctx)
    } catch (setupError) {
        try {
            await ctx.close()
        } catch {
            // 설정 오류가 정리 오류에 가려지지 않게 원래 오류를 유지한다.
        }

        throw setupError
    }

    // 앱별 자원과 모델은 close에서 정리하고, 파일이 공유하는 MongoClient는 Jest afterAll에서 닫는다.
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

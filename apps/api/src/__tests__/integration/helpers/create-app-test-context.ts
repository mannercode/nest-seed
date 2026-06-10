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
import { AppModule } from '../../../app.module'

/**
 * 통합 테스트용 NestJS 앱을 부팅한다.
 * `AppModule` 전체를 가져오므로 운영 환경과 같은 모듈 그래프 위에서 검증한다.
 * 테스트 픽스처는 추가 `imports`나 컨트롤러를 따로 선언할 필요가 없다.
 * 제공자를 mock 구현으로 바꾸거나 가드를 끄려면 `overrideProviders`와 `ignoreGuards` 옵션을 사용한다.
 */
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

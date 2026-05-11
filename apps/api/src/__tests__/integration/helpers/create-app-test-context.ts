import { AppLoggerService, getRedisConnectionToken } from '@mannercode/common'
import {
    createHttpTestContext,
    isDebuggingEnabled,
    type HttpTestContext,
    type ModuleMetadataEx
} from '@mannercode/testing'
import { ConfigService } from '@nestjs/config'
import { SchedulerRegistry } from '@nestjs/schedule'
import compression from 'compression'
import { AppConfigService, REDIS_CONNECTION_NAME } from 'config'
import express from 'express'
import { AppModule } from '../../../app.module'

/**
 * 통합 테스트용 NestJS 앱을 띄운다. `AppModule` 을 통째로 가져오므로 운영
 * 환경과 같은 모듈 그래프 위에서 검증한다. 테스트 fixture 는 추가
 * `imports` 나 컨트롤러를 따로 선언할 필요가 없다. mock 으로 바꾸거나
 * 가드를 끄려면 `overrideProviders` 와 `ignoreGuards` 옵션을 그대로 쓴다.
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

    const teardown = async () => {
        await ctx.close()

        const redis = ctx.module.get(getRedisConnectionToken(REDIS_CONNECTION_NAME))
        await redis.quit()
    }

    return { ...ctx, teardown }
}

export type AppTestContext = Awaited<ReturnType<typeof createAppTestContext>>

/**
 * @example
 * const configMock = createConfigServiceMock({ S3_ENDPOINT: s3.endpoint })
 * const ctx = await createAppTestContext({
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

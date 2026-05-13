import {
    AppLoggerService,
    getNatsConnectionToken,
    getRedisConnectionToken,
    type NatsConnection
} from '@mannercode/common'
import {
    createHttpTestContext,
    isDebuggingEnabled,
    type HttpTestContext,
    type ModuleMetadataEx
} from '@mannercode/testing'
import { ConfigService } from '@nestjs/config'
import { SchedulerRegistry } from '@nestjs/schedule'
import compression from 'compression'
import { AppConfigService, NATS_CONNECTION_NAME, REDIS_CONNECTION_NAME } from 'config'
import express from 'express'
import { AppModule } from '../../../app.module'

/**
 * 통합 테스트용 NestJS 앱을 부팅한다. `AppModule` 전체를 가져오므로 운영 환경과
 * 같은 모듈 그래프 위에서 검증한다. 테스트 픽스처는 추가 `imports`나 컨트롤러를
 * 따로 선언할 필요가 없다. 제공자를 mock 구현으로 바꾸거나 가드를 끄려면
 * `overrideProviders`와 `ignoreGuards` 옵션을 사용한다.
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
        const redis = ctx.module.get(getRedisConnectionToken(REDIS_CONNECTION_NAME))
        const nats = ctx.module.get<NatsConnection>(getNatsConnectionToken(NATS_CONNECTION_NAME))

        await ctx.close()
        await Promise.all([redis.quit(), nats.drain().catch(() => undefined)])
    }

    return { ...ctx, teardown }
}

export type AppTestContext = Awaited<ReturnType<typeof createAppTestContext>>

/**
 * 설정 일부만 바꾸는 mock ConfigService를 만든다.
 *
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

import { AppLoggerService } from '@mannercode/common'
import {
    createHttpTestContext,
    isDebuggingEnabled,
    type HttpTestContext,
    type ModuleMetadataEx
} from '@mannercode/testing'
import { SchedulerRegistry } from '@nestjs/schedule'
import compression from 'compression'
import express from 'express'
import { ShowtimeCreationRestateEndpoint, ShowtimeCreationWorkflowClient } from '#application'
import { AppConfigService, MongoConnection } from '#config'
import { getSharedTestMongoConnection } from '../../../scripts/index.cjs'
import { AppModule } from '../../app.module.js'

type AppTestOptions = ModuleMetadataEx & { enableRestate?: boolean }

export async function createAppTestContext({
    enableRestate = false,
    ...metadata
}: AppTestOptions = {}) {
    let restateDeploymentId: string | undefined
    const restateCompletions = new Set<Promise<void>>()
    const imports = [AppModule, ...(metadata.imports ?? [])]
    const sharedMongo = getSharedTestMongoConnection()
    const overrideProviders = [
        {
            original: MongoConnection,
            replacement: new MongoConnection(sharedMongo.client, sharedMongo.db, false)
        },
        ...(enableRestate
            ? []
            : [
                  {
                      original: ShowtimeCreationRestateEndpoint,
                      replacement: { onApplicationBootstrap() {}, onApplicationShutdown() {} }
                  },
                  {
                      original: ShowtimeCreationWorkflowClient,
                      replacement: {
                          submit() {
                              throw new Error('Restate is disabled for this test context.')
                          }
                      }
                  }
              ]),
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
        if (enableRestate) {
            restateDeploymentId = await registerRestateEndpoint(ctx)
            trackRestateCompletions(ctx, restateCompletions)
        }
        await stopAllCronJobs(ctx)
    } catch (setupError) {
        try {
            await ctx.close()
        } catch {
            // 설정 오류가 정리 오류에 가려지지 않게 원래 오류를 유지한다.
        }

        throw setupError
    }

    // 앱별 자원은 close에서 정리하고, 파일이 공유하는 MongoClient는 Vitest afterAll에서 닫는다.
    const teardown = async () => {
        try {
            if (enableRestate) {
                await Promise.all(restateCompletions)
                await unregisterRestateDeployment(restateDeploymentId)
            }
        } finally {
            await ctx.close()
        }
    }

    return { ...ctx, teardown }
}

function trackRestateCompletions(ctx: HttpTestContext, completions: Set<Promise<void>>) {
    const client = ctx.module.get(ShowtimeCreationWorkflowClient)
    const submit = client.submit.bind(client)
    client.submit = async (...args) => {
        const submission = await submit(...args)
        let completion!: Promise<void>
        completion = client
            .waitForCompletion(submission)
            .then(
                () => undefined,
                () => undefined
            )
            .finally(() => completions.delete(completion))
        completions.add(completion)
        return submission
    }
}

async function registerRestateEndpoint(ctx: HttpTestContext) {
    const adminUrl = requiredEnvironment('RESTATE_ADMIN_URL')
    const containerName = requiredEnvironment('COMPOSE_PROJECT_NAME')
    const endpoint = ctx.module.get(ShowtimeCreationRestateEndpoint)
    const uri = `http://${containerName}:${endpoint.port}`
    const response = await fetch(`${adminUrl}/deployments`, {
        body: JSON.stringify({ force: false, uri, use_http_11: false }),
        headers: { 'content-type': 'application/json' },
        method: 'POST'
    })

    if (!response.ok) {
        throw new Error(`Restate test endpoint registration failed: ${await response.text()}`)
    }

    const registration = (await response.json()) as { id?: unknown }
    if (typeof registration.id !== 'string') {
        throw new Error('Restate test endpoint registration did not return a deployment ID.')
    }
    return registration.id
}

async function unregisterRestateDeployment(deploymentId: string | undefined) {
    if (!deploymentId) return

    const adminUrl = requiredEnvironment('RESTATE_ADMIN_URL')
    // 현재 테스트의 workflow가 끝난 뒤 임시 deployment만 지운다. Restate의 일반 삭제는
    // 완료된 invocation retention 때문에 막힐 수 있어 테스트 teardown에서는 force가 필요하다.
    const response = await fetch(
        `${adminUrl}/deployments/${encodeURIComponent(deploymentId)}?force=true`,
        { method: 'DELETE' }
    )

    if (!response.ok) {
        throw new Error(`Restate test endpoint removal failed: ${await response.text()}`)
    }
}

function requiredEnvironment(name: string) {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be defined.`)
    return value
}

export type AppTestContext = Awaited<ReturnType<typeof createAppTestContext>>

async function stopAllCronJobs(ctx: HttpTestContext) {
    const scheduler = ctx.module.get(SchedulerRegistry)

    const cronJobs = scheduler.getCronJobs()

    for (const [_name, job] of cronJobs.entries()) {
        await job.stop()
    }
}

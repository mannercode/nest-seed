import { AppLoggerService, MongoConnection, RestateEndpoint } from '@mannercode/common'
import {
    createTestContext,
    HttpTestClient,
    isDebuggingEnabled,
    type TestContext,
    type TestModuleOptions
} from '@mannercode/testing'
import { SchedulerRegistry } from '@nestjs/schedule'
import { AppConfigService } from '#config'
import { DEMO_EVENTS_MAX_BYTES } from '#infrastructure'
import { AppModule } from '../../app.module.js'
import { configureHttpApp, initializeApi } from '../../bootstrap.js'
import { TextJobWorkflowClient } from '../../services/infrastructure/job-demo/worker.js'
import { getSharedTestMongoConnection } from './shared-mongo-connection.js'

const TEST_DEMO_EVENTS_MAX_BYTES = 1024 * 1024

export async function createAppTestContext(metadata: TestModuleOptions = {}) {
    const imports = [AppModule, ...(metadata.imports ?? [])]
    const sharedMongo = getSharedTestMongoConnection()
    const overrideProviders = [
        { original: DEMO_EVENTS_MAX_BYTES, replacement: TEST_DEMO_EVENTS_MAX_BYTES },
        {
            original: MongoConnection,
            replacement: new MongoConnection(sharedMongo.client, sharedMongo.db, false)
        },
        ...(metadata.overrideProviders ?? [])
    ]

    await using setup = new AsyncDisposableStack()
    const ctx = await createTestContext({
        ...metadata,
        imports,
        overrideProviders,
        configureApp: async (app) => {
            configureHttpApp(app)
            if (isDebuggingEnabled()) {
                const logger = app.get(AppLoggerService)
                app.useLogger(logger)
            }
            await metadata.configureApp?.(app)
        }
    })

    setup.defer(ctx.close)
    const { adminUrl, uri } = ctx.app.get(AppConfigService).restateDeployment
    const deploymentUrl = await initializeApi(ctx.app, {
        adminUrl,
        uri: testDeploymentUri(uri, ctx.app.get(RestateEndpoint).port)
    })
    const waitForWorkflows = trackRestateCompletions(ctx.module.get(TextJobWorkflowClient))
    setup.defer(async () => {
        await waitForWorkflows()
        await unregisterRestateDeployment(deploymentUrl)
    })
    await stopAllCronJobs(ctx)

    await ctx.app.listen(0, '127.0.0.1')
    const httpClient = new HttpTestClient(await ctx.app.getUrl())
    const resources = setup.move()
    return { ...ctx, httpClient, teardown: () => resources.disposeAsync() }
}

export function trackRestateCompletions<Input, Submission>(client: {
    submit(input: Input, id: string): Promise<Submission>
    waitForCompletion(submission: Submission): Promise<unknown>
}) {
    const completions = new Set<Promise<unknown>>()
    const failures: unknown[] = []
    const submit = client.submit.bind(client)
    client.submit = (...args) => {
        const submission = submit(...args)
        const completion = submission
            .then((job) => client.waitForCompletion(job))
            .catch((error: unknown) => failures.push(error))
            .finally(() => completions.delete(completion))
        completions.add(completion)
        return submission
    }
    return async () => {
        while (completions.size > 0) await Promise.all(completions)
        if (failures.length)
            throw new AggregateError(failures, 'Could not confirm Restate workflow completion')
    }
}

export function testDeploymentUri(uri: string, port: number) {
    const address = new URL(uri)
    address.port = String(port)
    return address.href
}

export async function unregisterRestateDeployment(deploymentUrl: URL) {
    // 완료 기록의 retention이 남아 있어도 이 테스트의 임시 deployment를 정리한다.
    deploymentUrl.searchParams.set('force', 'true')
    const response = await fetch(deploymentUrl, { method: 'DELETE' })
    if (!response.ok) {
        throw new Error(`Restate test endpoint removal failed: ${await response.text()}`)
    }
}

export type AppTestContext = Awaited<ReturnType<typeof createAppTestContext>>

async function stopAllCronJobs(ctx: TestContext) {
    const scheduler = ctx.module.get(SchedulerRegistry)

    const cronJobs = scheduler.getCronJobs()

    for (const [_name, job] of cronJobs.entries()) {
        await job.stop()
    }
}

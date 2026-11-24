import {
    AppLoggerService,
    MongoConnection,
    RestateEndpoint,
    type DurableWorkflowSubmission
} from '@mannercode/common'
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
    const restateCompletions = new Set<Promise<void>>()
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
    const address = new URL(uri)
    address.port = String(ctx.app.get(RestateEndpoint).port)
    const deploymentUrl = await initializeApi(ctx.app, { adminUrl, uri: address.href })
    setup.defer(() => unregisterRestateDeployment(deploymentUrl))

    trackRestateCompletions(ctx.module.get(TextJobWorkflowClient), restateCompletions)
    setup.defer(async () => {
        while (restateCompletions.size > 0) await Promise.all(restateCompletions)
    })
    await stopAllCronJobs(ctx)

    await ctx.app.listen(0, '127.0.0.1')
    const httpClient = new HttpTestClient(await ctx.app.getUrl())
    const resources = setup.move()
    return { ...ctx, httpClient, teardown: () => resources.disposeAsync() }
}

function trackRestateCompletions<Input, Output>(
    client: {
        submit(input: Input, id: string): Promise<DurableWorkflowSubmission<Output>>
        waitForCompletion(submission: DurableWorkflowSubmission<Output>): Promise<Output>
    },
    completions: Set<Promise<void>>
) {
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

async function unregisterRestateDeployment(deploymentUrl: URL) {
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

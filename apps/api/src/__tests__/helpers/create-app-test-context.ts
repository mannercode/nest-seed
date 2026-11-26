import {
    AppLoggerService,
    MongoConnection,
    RestateEndpoint,
    TemporalJsonSerde
} from '@mannercode/common'
import {
    createTestContext,
    HttpTestClient,
    isDebuggingEnabled,
    type TestContext,
    type TestModuleOptions
} from '@mannercode/testing'
import { SchedulerRegistry } from '@nestjs/schedule'
import { connect } from '@restatedev/restate-sdk-clients'
import { hostname } from 'node:os'
import { AppConfigService } from '#config'
import {
    DEMO_EVENTS_MAX_BYTES,
    JobDemoService,
    TextJobResultSchema,
    TextJobWorkflow
} from '#infrastructure'
import { AppModule } from '#api/app.module'
import { configureHttpApp, initializeApi } from '#api/bootstrap'
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
    const { restate, restateDeployment } = ctx.app.get(AppConfigService)
    const ingress = connect({ url: restate.ingressUrl, retry: true, serde: TemporalJsonSerde })
    const { definition } = ctx.app.get(TextJobWorkflow)
    const waitForJob = async (jobId: string) =>
        TextJobResultSchema.parse(
            await ingress.workflowClient<typeof definition>(definition, jobId).workflowAttach()
        )
    const waitForWorkflows = trackRestateCompletions(ctx.app.get(JobDemoService), waitForJob)
    const deploymentUrl = await initializeApi(ctx.app, {
        adminUrl: restateDeployment.adminUrl,
        uri: testDeploymentUri(ctx.app.get(RestateEndpoint).port)
    })
    setup.defer(async () => {
        await waitForWorkflows()
        await unregisterRestateDeployment(deploymentUrl)
    })
    await stopAllCronJobs(ctx)

    await ctx.app.listen(0, '127.0.0.1')
    const httpClient = new HttpTestClient(await ctx.app.getUrl())
    const resources = setup.move()
    return {
        ...ctx,
        httpClient,
        deploymentUrl,
        waitForJob,
        teardown: () => resources.disposeAsync()
    }
}

export function trackRestateCompletions(
    jobs: Pick<JobDemoService, 'submit'>,
    waitForJob: (jobId: string) => Promise<unknown>
) {
    const completions = new Set<Promise<unknown>>()
    const failures: unknown[] = []
    const submit = jobs.submit.bind(jobs)
    jobs.submit = (...args) => {
        const submission = submit(...args)
        const completion = submission
            .then(({ jobId }) => waitForJob(jobId))
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

export function testDeploymentUri(port: number) {
    return `http://${hostname()}:${port}`
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

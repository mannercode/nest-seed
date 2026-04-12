import { bundleWorkflowCode, NativeConnection, Worker } from '@temporalio/worker'
import { getTemporalTaskQueue } from 'config'

export type TemporalTestWorkerOptions = { activities: object }

let workflowBundleCache: Awaited<ReturnType<typeof bundleWorkflowCode>> | undefined

export async function createTemporalTestWorker(options: TemporalTestWorkerOptions) {
    const address = `${process.env.TEMPORAL_HOST}:${process.env.TEMPORAL_PORT}`

    const connection = await NativeConnection.connect({ address })

    workflowBundleCache ??= await bundleWorkflowCode({
        workflowsPath: require.resolve('../../applications/workflows.ts')
    })

    const worker = await Worker.create({
        connection,
        namespace: 'default',
        taskQueue: getTemporalTaskQueue(),
        workflowBundle: workflowBundleCache,
        activities: options.activities
    })

    const runPromise = worker.run()

    return {
        worker,
        async shutdown() {
            worker.shutdown()
            await runPromise
            await connection.close()
        }
    }
}

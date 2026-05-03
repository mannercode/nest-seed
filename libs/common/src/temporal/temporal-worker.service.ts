import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { bundleWorkflowCode, NativeConnection, Worker } from '@temporalio/worker'
import { existsSync, readFileSync } from 'fs'
import { TemporalWorkerOptions } from './temporal.types'

@Injectable()
export class TemporalWorkerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TemporalWorkerService.name)
    private worker?: Worker
    private connection?: NativeConnection
    private runPromise?: Promise<void>

    constructor(private readonly options: TemporalWorkerOptions) {}

    async onModuleInit() {
        this.connection = await NativeConnection.connect({ address: this.options.address })

        const workflowBundle = await this.resolveWorkflowBundle()

        this.worker = await Worker.create({
            activities: this.options.activities,
            connection: this.connection,
            namespace: this.options.namespace,
            taskQueue: this.options.taskQueue,
            workflowBundle
        })

        // run() resolves only after the worker has fully shut down (drained
        // in-flight activities, polls stopped). Hold the promise so
        // onModuleDestroy can await it — otherwise activities can race
        // dependency-module disposal (mongoose close mid-query etc.).
        this.runPromise = this.worker.run().catch(
            /* istanbul ignore next */ (err) => {
                this.logger.error('temporal worker run() failed', err)
            }
        )
    }

    async onModuleDestroy() {
        this.worker?.shutdown()
        // Await full drain before closing the underlying connection so
        // activities still in flight can complete or be cancelled cleanly.
        if (this.runPromise) await this.runPromise
        await this.connection?.close().catch(() => undefined)
    }

    /**
     * Production: load the pre-built bundle that the build step (e.g.
     * `apps/api/scripts/bundle-workflows.js`) wrote to disk. After webpack
     * collapses the app into one `index.js`, `bundleWorkflowCode` cannot
     * resolve workflowsPath at runtime — it would need the source tree
     * which is not shipped.
     *
     * Dev / tests: bundle the source on the fly via workflowsPath.
     */
    private async resolveWorkflowBundle() {
        const { workflowBundlePath, workflowsPath } = this.options
        if (workflowBundlePath && existsSync(workflowBundlePath)) {
            return { code: readFileSync(workflowBundlePath, 'utf8') }
        }
        if (!workflowsPath) {
            throw new Error(
                'TemporalWorkerService: neither workflowBundlePath (file present) nor workflowsPath was provided'
            )
        }
        return bundleWorkflowCode({ workflowsPath })
    }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { bundleWorkflowCode, NativeConnection, Worker } from '@temporalio/worker'

export type TemporalWorkerOptions = {
    address: string
    namespace: string
    taskQueue: string
    workflowsPath: string
    activities: object
}

@Injectable()
export class TemporalWorkerService implements OnModuleInit, OnModuleDestroy {
    private worker!: Worker
    private connection!: NativeConnection
    private runPromise!: Promise<void>

    constructor(private readonly options: TemporalWorkerOptions) {}

    async onModuleInit() {
        this.connection = await NativeConnection.connect({ address: this.options.address })

        const workflowBundle = await bundleWorkflowCode({
            workflowsPath: this.options.workflowsPath
        })

        this.worker = await Worker.create({
            connection: this.connection,
            namespace: this.options.namespace,
            taskQueue: this.options.taskQueue,
            workflowBundle,
            activities: this.options.activities
        })

        this.runPromise = this.worker.run()
    }

    async onModuleDestroy() {
        this.worker.shutdown()
        await this.runPromise
        await this.connection.close()
    }
}

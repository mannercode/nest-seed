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

    constructor(private readonly options: TemporalWorkerOptions) {}

    async onModuleInit() {
        const connection = await NativeConnection.connect({ address: this.options.address })

        const workflowBundle = await bundleWorkflowCode({
            workflowsPath: this.options.workflowsPath
        })

        this.worker = await Worker.create({
            connection,
            namespace: this.options.namespace,
            taskQueue: this.options.taskQueue,
            workflowBundle,
            activities: this.options.activities
        })

        void this.worker.run()
    }

    async onModuleDestroy() {
        this.worker.shutdown()
    }
}

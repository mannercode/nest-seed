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

        // run() 은 worker 가 완전히 종료된 (in-flight activity 가 drain 되고
        // polling 이 멈춘) 뒤에야 resolve 된다. promise 를 잡아 두어야
        // onModuleDestroy 에서 await 할 수 있다 — 그렇지 않으면 activity 가
        // 의존 module disposal (mongoose 가 query 중간에 close 되는 등) 과
        // race 할 수 있다.
        this.runPromise = this.worker.run().catch(
            /* istanbul ignore next */ (err: unknown) => {
                this.logger.error('temporal worker run() failed', err)
            }
        )
    }

    async onModuleDestroy() {
        this.worker?.shutdown()
        // 진행 중인 activity 가 깔끔하게 완료되거나 취소될 수 있도록 underlying
        // connection 을 닫기 전에 완전한 drain 을 기다린다.
        if (this.runPromise) await this.runPromise
        await this.connection?.close().catch(() => undefined)
    }

    /**
     * Production: build step (예: `apps/api/scripts/bundle-workflows.js`)
     * 이 disk 에 써둔 pre-built bundle 을 load 한다. webpack 이 app 을 한
     * `index.js` 로 합치고 나면 `bundleWorkflowCode` 가 runtime 에
     * workflowsPath 를 resolve 할 수 없다 — source tree 가 필요한데
     * ship 되지 않기 때문.
     *
     * Dev / tests: workflowsPath 를 통해 source 를 즉석에서 bundling 한다.
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

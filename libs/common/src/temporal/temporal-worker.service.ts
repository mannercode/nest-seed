import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { IllegalStateError, NativeConnection, Worker } from '@temporalio/worker'
import { readFileSync } from 'fs'
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

        this.worker = await Worker.create({
            activities: this.options.activities,
            connection: this.connection,
            namespace: this.options.namespace,
            taskQueue: this.options.taskQueue,
            workflowBundle: { code: readFileSync(this.options.workflowBundlePath, 'utf8') }
        })

        // 의존 모듈이 액티비티보다 먼저 닫히지 않도록 완전 종료 Promise를 보관한다.
        this.runPromise = this.worker.run().catch(
            /* istanbul ignore next */ (err: unknown) => {
                this.logger.error('temporal worker run() failed', err)
            }
        )
    }

    async onModuleDestroy() {
        // 이미 멈춘 워커의 IllegalStateError는 무시하고 연결 정리를 계속한다.
        try {
            this.worker?.shutdown()
        } catch (error) {
            if (!(error instanceof IllegalStateError)) throw error
        }

        try {
            // 액티비티가 종료 또는 취소된 뒤 연결을 닫는다.
            if (this.runPromise) await this.runPromise
        } finally {
            await this.connection?.close().catch(() => undefined)
        }
    }
}

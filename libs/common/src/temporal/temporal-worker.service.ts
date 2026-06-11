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

        // `run()`은 워커가 완전히 종료된 뒤에만 resolve 된다.
        // 진행 중이던 액티비티가 모두 끝나고 polling이 멈춘 시점이다.
        // 이 Promise를 들고 있어야 `onModuleDestroy`에서 기다릴 수 있다.
        // 그러지 않으면 액티비티가 끝나기 전에 의존 모듈이 먼저 닫혀, mongoose가 쿼리 중간에 끊기는 식의 경합이 생긴다.
        this.runPromise = this.worker.run().catch(
            /* istanbul ignore next */ (err: unknown) => {
                this.logger.error('temporal worker run() failed', err)
            }
        )
    }

    async onModuleDestroy() {
        // 워커가 이미 멈춰 있으면(run() 실패, 시그널 핸들러의 선행 종료, 중복 destroy)
        // `shutdown()`이 IllegalStateError를 동기로 던진다. 그 경우에도 아래 정리는 계속해야 한다.
        try {
            this.worker?.shutdown()
        } catch (error) {
            if (!(error instanceof IllegalStateError)) throw error
        }

        try {
            // 진행 중이던 액티비티가 정상 종료 또는 취소까지 도달하도록,
            // 연결을 닫기 전에 워커가 완전히 멈출 때까지 기다린다.
            if (this.runPromise) await this.runPromise
        } finally {
            await this.connection?.close().catch(() => undefined)
        }
    }
}

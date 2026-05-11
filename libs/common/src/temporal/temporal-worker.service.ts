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

        // `run()`은 워커가 완전히 종료된 뒤에만 resolve 됩니다. 진행 중이던
        // 액티비티가 모두 끝나고 polling이 멈춘 시점입니다. 이 Promise를
        // 들고 있어야 `onModuleDestroy`에서 기다릴 수 있습니다. 그러지 않으면
        // 액티비티가 끝나기 전에 의존 모듈이 먼저 닫혀, mongoose가 쿼리
        // 중간에 끊기는 식의 경합이 생깁니다.
        this.runPromise = this.worker.run().catch(
            /* istanbul ignore next */ (err: unknown) => {
                this.logger.error('temporal worker run() failed', err)
            }
        )
    }

    async onModuleDestroy() {
        this.worker?.shutdown()
        // 진행 중이던 액티비티가 정상 종료 또는 취소까지 도달하도록, 연결을
        // 닫기 전에 워커가 완전히 빠질 때까지 기다립니다.
        if (this.runPromise) await this.runPromise
        await this.connection?.close().catch(() => undefined)
    }

    /**
     * 운영 환경에서는 빌드 단계에서 만든 workflow 번들 파일을 읽습니다. webpack이
     * 앱을 한 `index.js`로 합치면 런타임의 `bundleWorkflowCode`가 원본 workflow
     * 파일 트리를 찾을 수 없기 때문입니다.
     *
     * dev와 테스트에서는 미리 만든 번들이 없으므로, `workflowsPath`로
     * 소스를 가리켜 그 자리에서 번들을 만듭니다.
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

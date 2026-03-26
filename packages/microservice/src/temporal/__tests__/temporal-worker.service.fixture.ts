import { createTestContext, getTemporalTestConnection } from '@mannercode/testing'
import type { TemporalWorkerOptions } from '../temporal-worker.service'
import { TemporalWorkerService } from '../temporal-worker.service'

export type TemporalWorkerServiceFixture = {
    service: TemporalWorkerService
    teardown: () => Promise<void>
}

const TEMPORAL_WORKER_OPTIONS = Symbol('TEMPORAL_WORKER_OPTIONS')

export async function createTemporalWorkerServiceFixture() {
    const options: TemporalWorkerOptions = {
        address: getTemporalTestConnection(),
        namespace: 'default',
        taskQueue: `test-queue-${Date.now()}`,
        workflowsPath: require.resolve('./temporal-worker.workflows'),
        activities: { greet: async (name: string) => `Hello, ${name}!` }
    }

    const { close, module } = await createTestContext({
        providers: [
            { provide: TEMPORAL_WORKER_OPTIONS, useValue: options },
            {
                provide: TemporalWorkerService,
                useFactory: (opts: TemporalWorkerOptions) => new TemporalWorkerService(opts),
                inject: [TEMPORAL_WORKER_OPTIONS]
            }
        ]
    })

    const service = module.get(TemporalWorkerService)

    const teardown = async () => {
        await close()
    }

    return { service, teardown }
}

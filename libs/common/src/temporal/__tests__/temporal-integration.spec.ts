import type { Client, Connection } from '@temporalio/client'
import { withTestId } from '@mannercode/testing'
import type { TemporalClientConfig } from '../temporal.types'

// 이 파일 전체가 공유하는 단일 Connection + Client.
// 각 `it` 안의 `await import`(프로젝트 컨벤션: resetModules: true)는
// SUT 모듈에 새로운 클래스 identity를 부여하고, 살아 있는 인프라 핸들만 재사용한다.
let connection: Connection
let client: Client

const config = (): TemporalClientConfig => ({
    address: process.env.TESTLIB_TEMPORAL_ADDRESS as string,
    namespace: process.env.TESTLIB_TEMPORAL_NAMESPACE as string
})

beforeAll(async () => {
    const { Client, Connection } = await import('@temporalio/client')
    const { address, namespace } = config()
    connection = await Connection.connect({ address })
    client = new Client({ connection, namespace })
}, 60_000)

afterAll(async () => {
    await connection.close()
})

describe('InjectTemporalClient', () => {
    it('이름 없이 호출하면 파라미터 데코레이터를 반환한다', async () => {
        const { InjectTemporalClient } = await import('../temporal-client.module')
        expect(typeof InjectTemporalClient(undefined)).toBe('function')
    })

    it('이름과 함께 호출해도 파라미터 데코레이터를 반환한다', async () => {
        const { InjectTemporalClient } = await import('../temporal-client.module')
        expect(typeof InjectTemporalClient('my-client')).toBe('function')
    })
})

describe('TemporalClientModule.forRootAsync', () => {
    it('이름 없이 등록하면 기본 토큰에 Connection과 Client를 노출한다', async () => {
        const { TemporalClientModule } = await import('../temporal-client.module')
        const { getTemporalClientToken, getTemporalConnectionToken } =
            await import('../temporal.tokens')
        const { Test } = await import('@nestjs/testing')

        const moduleRef = await Test.createTestingModule({
            imports: [TemporalClientModule.forRootAsync({ useFactory: () => config() })]
        }).compile()

        try {
            expect(moduleRef.get(getTemporalConnectionToken())).toBeDefined()
            expect(moduleRef.get(getTemporalClientToken())).toBeDefined()
        } finally {
            await moduleRef.close()
        }
    })

    it('clientName을 지정하면 두 토큰 모두 그 이름을 사용한다', async () => {
        const { TemporalClientModule } = await import('../temporal-client.module')
        const { getTemporalClientToken, getTemporalConnectionToken } =
            await import('../temporal.tokens')
        const { Test } = await import('@nestjs/testing')

        const moduleRef = await Test.createTestingModule({
            imports: [TemporalClientModule.forRootAsync({ useFactory: () => config() }, 'orders')]
        }).compile()

        try {
            expect(moduleRef.get(getTemporalConnectionToken('orders'))).toBeDefined()
            expect(moduleRef.get(getTemporalClientToken('orders'))).toBeDefined()
        } finally {
            await moduleRef.close()
        }
    })

    it('inject로 지정한 provider가 useFactory의 인자로 전달된다', async () => {
        const { Global, Module } = await import('@nestjs/common')
        const { TemporalClientModule } = await import('../temporal-client.module')
        const { Test } = await import('@nestjs/testing')

        const ADDRESS_TOKEN = 'TEMPORAL_TEST_ADDRESS'
        const calls: string[] = []
        const { address, namespace } = config()

        // forRootAsync의 dynamic module은 global이지만 inject 토큰은 어딘가에서
        // 해석되어야 한다. 그래서 @Global() 헬퍼 모듈로 ADDRESS_TOKEN을 노출한다.
        @Global()
        @Module({
            providers: [{ provide: ADDRESS_TOKEN, useValue: address }],
            exports: [ADDRESS_TOKEN]
        })
        class AddressModule {}

        const moduleRef = await Test.createTestingModule({
            imports: [
                AddressModule,
                TemporalClientModule.forRootAsync(
                    {
                        inject: [ADDRESS_TOKEN],
                        useFactory: (addr: string) => {
                            calls.push(addr)
                            return { address: addr, namespace }
                        }
                    },
                    'with-inject'
                )
            ]
        }).compile()

        try {
            // useFactory는 두 provider(connection, client)에 연결되어 있어
            // 같은 주입 address로 두 번 실행된다.
            expect(calls).toEqual([address, address])
        } finally {
            await moduleRef.close()
        }
    })

    it('모듈 종료 시 connection을 닫고, 닫기 실패는 무시한다', async () => {
        const { TemporalClientModule, TemporalConnectionRegistry } =
            await import('../temporal-client.module')
        const { Test } = await import('@nestjs/testing')

        const moduleRef = await Test.createTestingModule({
            imports: [
                TemporalClientModule.forRootAsync({ useFactory: () => config() }, 'destroy-test')
            ]
        }).compile()

        // close()가 reject하는 가짜 connection 을 registry 에 추가해
        // onModuleDestroy 의 .catch(() => undefined) 분기를 커버한다.
        const fakeConnection = {
            close: jest.fn(async () => {
                throw new Error('boom')
            })
        }
        const registry = moduleRef.get(TemporalConnectionRegistry)
        registry.add(fakeConnection as any)

        await expect(moduleRef.close()).resolves.toBeUndefined()

        expect(fakeConnection.close).toHaveBeenCalled()
        // 종료 후 registry 도 비워진다.
        expect(registry.list()).toEqual([])
    })
})

describe('TemporalWorkerService', () => {
    it('워커가 connect→bundle→run을 거쳐 workflow를 실행하고 정상 종료한다', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const taskQueue = withTestId('worker')
        const calls: string[] = []
        const { address, namespace } = config()

        const service = new TemporalWorkerService({
            activities: {
                echo: async (msg: string) => {
                    calls.push(msg)
                    return `echo:${msg}`
                }
            },
            address,
            namespace,
            taskQueue,
            workflowsPath: require.resolve('./workflows')
        })

        await service.onModuleInit()

        try {
            const { echoWorkflow } = await import('./workflows')
            const result = await client.workflow.execute(echoWorkflow, {
                args: ['hello'],
                taskQueue,
                workflowId: withTestId('wf')
            })
            expect(result).toBe('echo:hello')
            expect(calls).toEqual(['hello'])
        } finally {
            await service.onModuleDestroy()
        }
    }, 120_000)

    it('init 없이 destroy만 호출해도 예외를 던지지 않는다', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const service = new TemporalWorkerService({
            activities: {},
            address: 'unused:0',
            namespace: 'default',
            taskQueue: 'unused',
            workflowsPath: require.resolve('./workflows')
        })
        await expect(service.onModuleDestroy()).resolves.toBeUndefined()
    })

    it('workflowBundlePath가 있으면 그 파일을 그대로 워커에 주입한다', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const { bundleWorkflowCode } = await import('@temporalio/worker')
        const fs = await import('fs')
        const path = await import('path')
        const os = await import('os')

        const taskQueue = withTestId('worker-bundle')
        const { address, namespace } = config()

        // 미리 번들해 임시 파일로 저장한다(프로덕션 빌드 단계가 만들어 두는 형태와 동일).
        const { code } = await bundleWorkflowCode({ workflowsPath: require.resolve('./workflows') })
        const bundlePath = path.join(os.tmpdir(), `${withTestId('wf-bundle')}.js`)
        fs.writeFileSync(bundlePath, code)

        const service = new TemporalWorkerService({
            activities: { echo: async (msg: string) => `echo:${msg}` },
            address,
            namespace,
            taskQueue,
            workflowBundlePath: bundlePath
        })

        await service.onModuleInit()

        try {
            const { echoWorkflow } = await import('./workflows')
            const result = await client.workflow.execute(echoWorkflow, {
                args: ['from-bundle'],
                taskQueue,
                workflowId: withTestId('wf')
            })
            expect(result).toBe('echo:from-bundle')
        } finally {
            await service.onModuleDestroy()
            fs.unlinkSync(bundlePath)
        }
    }, 120_000)

    it('workflowsPath와 workflowBundlePath가 모두 없으면 예외를 던진다', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const { address, namespace } = config()

        const service = new TemporalWorkerService({
            activities: {},
            address,
            namespace,
            taskQueue: withTestId('worker-no-bundle')
            // 둘 다 누락
        })

        await expect(service.onModuleInit()).rejects.toThrow(
            /neither workflowBundlePath.*nor workflowsPath/
        )
        await service.onModuleDestroy()
    })

    it('connection.close()가 예외를 던져도 destroy가 정상 종료된다', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const taskQueue = withTestId('worker-close')
        const { address, namespace } = config()

        const service = new TemporalWorkerService({
            activities: { echo: async (msg: string) => `echo:${msg}` },
            address,
            namespace,
            taskQueue,
            workflowsPath: require.resolve('./workflows')
        })

        await service.onModuleInit()

        const fakeConnection = {
            close: jest.fn(async () => {
                throw new Error('boom')
            })
        }
        ;(service as any).connection = fakeConnection

        await expect(service.onModuleDestroy()).resolves.toBeUndefined()
        expect(fakeConnection.close).toHaveBeenCalled()
    }, 120_000)

    it('onModuleDestroy는 worker 종료를 기다린 뒤에 connection을 닫는다', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const taskQueue = withTestId('worker-shutdown-order')
        const { address, namespace } = config()

        const service = new TemporalWorkerService({
            activities: { echo: async (msg: string) => `echo:${msg}` },
            address,
            namespace,
            taskQueue,
            workflowsPath: require.resolve('./workflows')
        })

        await service.onModuleInit()

        const order: string[] = []
        const realRunPromise = (service as any).runPromise as Promise<void>
        ;(service as any).runPromise = realRunPromise.then(() => order.push('worker-stopped'))
        const realConnection = (service as any).connection
        const closeSpy = jest.spyOn(realConnection, 'close').mockImplementation(async () => {
            order.push('connection-closed')
        })

        await service.onModuleDestroy()

        expect(order).toEqual(['worker-stopped', 'connection-closed'])
        expect(closeSpy).toHaveBeenCalled()
    }, 120_000)

    it('onModuleDestroy를 두 번 호출하면 두 번째는 아무 일도 일어나지 않는다', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const service = new TemporalWorkerService({
            activities: {},
            address: 'unused:0',
            namespace: 'default',
            taskQueue: 'unused',
            workflowsPath: require.resolve('./workflows')
        })

        await expect(service.onModuleDestroy()).resolves.toBeUndefined()
        await expect(service.onModuleDestroy()).resolves.toBeUndefined()
    })

    it('workflowBundlePath 파일이 없으면 런타임에 번들로 대체된다', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const taskQueue = withTestId('worker-missing-bundle')
        const { address, namespace } = config()

        const service = new TemporalWorkerService({
            activities: { echo: async (msg: string) => `echo:${msg}` },
            address,
            namespace,
            taskQueue,
            // 존재하지 않는 경로 + workflowsPath fallback.
            workflowBundlePath: '/tmp/this-file-definitely-does-not-exist.js',
            workflowsPath: require.resolve('./workflows')
        })

        await service.onModuleInit()

        try {
            const { echoWorkflow } = await import('./workflows')
            const result = await client.workflow.execute(echoWorkflow, {
                args: ['runtime-bundle'],
                taskQueue,
                workflowId: withTestId('wf')
            })
            expect(result).toBe('echo:runtime-bundle')
        } finally {
            await service.onModuleDestroy()
        }
    }, 120_000)

    it('workflowBundlePath가 빈 문자열이면 런타임에 번들로 대체된다', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const taskQueue = withTestId('worker-empty-bundle')
        const { address, namespace } = config()

        const service = new TemporalWorkerService({
            activities: { echo: async (msg: string) => `echo:${msg}` },
            address,
            namespace,
            taskQueue,
            workflowBundlePath: '',
            workflowsPath: require.resolve('./workflows')
        })

        await service.onModuleInit()

        try {
            const { echoWorkflow } = await import('./workflows')
            const result = await client.workflow.execute(echoWorkflow, {
                args: ['empty-bundle'],
                taskQueue,
                workflowId: withTestId('wf')
            })
            expect(result).toBe('echo:empty-bundle')
        } finally {
            await service.onModuleDestroy()
        }
    }, 120_000)
})

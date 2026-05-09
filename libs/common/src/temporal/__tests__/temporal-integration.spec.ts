import type { Client, Connection } from '@temporalio/client'
import { withTestId } from '@mannercode/testing'
import type { TemporalClientConfig } from '../temporal.types'

// 이 파일 전체가 공유하는 단일 Connection + Client. 각 `it` 안의
// `await import` (프로젝트 컨벤션: `resetModules: true`) 는 SUT 모듈들에
// 대해 새 클래스 identity 를 만들어 주고, 살아있는 infra handle 만 재사용한다.
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
    it.each([undefined, 'my-client'])(
        'name=%s 일 때 parameter decorator 를 반환한다',
        async (name) => {
            const { InjectTemporalClient } = await import('../temporal-client.module')
            expect(typeof InjectTemporalClient(name)).toBe('function')
        }
    )
})

describe('TemporalClientModule.forRootAsync', () => {
    it('이름 없이 등록하면 기본 토큰에 Connection 과 Client 를 노출한다', async () => {
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

    it('clientName 을 주면 두 토큰 모두 그 이름을 사용한다', async () => {
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

    it('inject 로 지정한 provider 가 useFactory 인자로 들어온다', async () => {
        const { Global, Module } = await import('@nestjs/common')
        const { TemporalClientModule } = await import('../temporal-client.module')
        const { Test } = await import('@nestjs/testing')

        const ADDRESS_TOKEN = 'TEMPORAL_TEST_ADDRESS'
        const calls: string[] = []
        const { address, namespace } = config()

        // forRootAsync 의 dynamic module 은 global 이지만 `inject` 토큰은
        // 어딘가에서 resolve 돼야 한다 — 그래서 @Global() helper module 로
        // ADDRESS_TOKEN 을 노출한다.
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
            // useFactory 는 두 provider (connection, client) 양쪽에 연결돼
            // 있어서 같은 주입 address 로 두 번 실행된다.
            expect(calls).toEqual([address, address])
        } finally {
            await moduleRef.close()
        }
    })

    it('모듈 destroy 시 connection 을 닫고, 닫기 실패도 무시한다', async () => {
        const { TemporalClientModule } = await import('../temporal-client.module')
        const { Test } = await import('@nestjs/testing')

        const moduleRef = await Test.createTestingModule({
            imports: [
                TemporalClientModule.forRootAsync({ useFactory: () => config() }, 'destroy-test')
            ]
        }).compile()

        // close() 가 reject 하는 bogus connection 을 push 해서 onModuleDestroy
        // 의 .catch(() => undefined) 분기를 커버한다.
        const fakeConnection = {
            close: jest.fn(async () => {
                throw new Error('boom')
            })
        }
        ;(TemporalClientModule as any).connections.push(fakeConnection)

        await expect(moduleRef.close()).resolves.toBeUndefined()

        expect(fakeConnection.close).toHaveBeenCalled()
        // destroy 후 정적 배열은 비워진다.
        expect((TemporalClientModule as any).connections).toEqual([])
    })
})

describe('TemporalWorkerService', () => {
    it('워커가 connect → bundle → run 을 거쳐 workflow 를 실행하고 정상 종료한다', async () => {
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

    it('init 을 호출하지 않고 destroy 만 호출해도 throw 하지 않는다', async () => {
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

    it('workflowBundlePath 가 존재하면 그 파일을 그대로 워커에 주입한다 (production 경로)', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const { bundleWorkflowCode } = await import('@temporalio/worker')
        const fs = await import('fs')
        const path = await import('path')
        const os = await import('os')

        const taskQueue = withTestId('worker-bundle')
        const { address, namespace } = config()

        // 미리 번들 → 임시 파일로 저장 (build step 이 production 에서 만들어 두는 형태와 동일)
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

    it('workflowsPath / workflowBundlePath 둘 다 없거나 잘못되면 명시적으로 throw 한다', async () => {
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

    it('connection.close() 가 throw 해도 destroy 가 무사히 끝난다', async () => {
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

    it.todo(
        'onModuleDestroy 이전에 worker.run() 의 promise 가 drain 된 뒤에야 connection 이 닫힌다 (ordering)'
    )
    it.todo('onModuleDestroy 가 두 번 호출돼도 두 번째는 no-op 이다')
    it.todo(
        'workflowBundlePath 가 지정됐지만 파일이 없으면 bundleWorkflowCode 런타임 호출로 fallback 한다'
    )
    it.todo(
        'workflowBundlePath 가 빈 문자열 ("") 이면 existsSync 가 false 라 bundleWorkflowCode fallback 으로 진행된다'
    )
})

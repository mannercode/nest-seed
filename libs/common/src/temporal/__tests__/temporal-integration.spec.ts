import type { Client, Connection } from '@temporalio/client'
import { getTemporalTestConnection, withTestId } from '@mannercode/testing'

// One Connection + Client shared across this file. The `await import` inside
// each `it` (project convention with `resetModules: true`) still gives fresh
// class identities for the modules under test — only the live infra handles
// are reused.
let connection: Connection
let client: Client

beforeAll(async () => {
    const { Client, Connection } = await import('@temporalio/client')
    const { address, namespace } = getTemporalTestConnection()
    connection = await Connection.connect({ address })
    client = new Client({ connection, namespace })
}, 60_000)

afterAll(async () => {
    await connection.close()
})

const config = () => getTemporalTestConnection()

describe('InjectTemporalClient', () => {
    // 이름 없이 호출하면 parameter decorator 를 반환한다 (기본 이름)
    it('returns a parameter decorator using the default name', async () => {
        const { InjectTemporalClient } = await import('../temporal-client.module')
        expect(typeof InjectTemporalClient()).toBe('function')
    })

    // 이름을 주면 그 이름의 client 토큰에 대한 decorator 를 반환한다
    it('returns a parameter decorator with an explicit name', async () => {
        const { InjectTemporalClient } = await import('../temporal-client.module')
        expect(typeof InjectTemporalClient('orders')).toBe('function')
    })
})

describe('TemporalClientModule.forRootAsync', () => {
    // 이름 없이 등록하면 기본 토큰에 Connection 과 Client 를 노출한다
    it('exposes Connection and Client at the default tokens', async () => {
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

    // clientName 을 주면 두 토큰 모두 그 이름을 사용한다
    it('uses the provided clientName for both tokens', async () => {
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

    // inject 로 지정한 provider 가 useFactory 인자로 들어온다
    it('passes injected providers to useFactory', async () => {
        const { Global, Module } = await import('@nestjs/common')
        const { TemporalClientModule } = await import('../temporal-client.module')
        const { Test } = await import('@nestjs/testing')

        const ADDRESS_TOKEN = 'TEMPORAL_TEST_ADDRESS'
        const calls: string[] = []
        const { address, namespace } = config()

        // forRootAsync's dynamic module is global, but its `inject` tokens
        // must still resolve from somewhere — so we expose ADDRESS_TOKEN via
        // a @Global() helper module.
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
            // useFactory is wired into both providers (connection and client),
            // so it runs twice with the same injected address.
            expect(calls).toEqual([address, address])
        } finally {
            await moduleRef.close()
        }
    })

    // 모듈 destroy 시 connection 을 닫고, 닫기 실패도 무시한다
    it('closes connections on destroy and tolerates close errors', async () => {
        const { TemporalClientModule } = await import('../temporal-client.module')
        const { Test } = await import('@nestjs/testing')

        const moduleRef = await Test.createTestingModule({
            imports: [
                TemporalClientModule.forRootAsync({ useFactory: () => config() }, 'destroy-test')
            ]
        }).compile()

        // Push a bogus connection whose close() rejects so we cover the
        // .catch(() => undefined) branch in onModuleDestroy.
        const fakeConnection = {
            close: jest.fn(async () => {
                throw new Error('boom')
            })
        }
        ;(TemporalClientModule as any).connections.push(fakeConnection)

        await expect(moduleRef.close()).resolves.toBeUndefined()

        expect(fakeConnection.close).toHaveBeenCalled()
        // Static array is reset after destroy.
        expect((TemporalClientModule as any).connections).toEqual([])
    })
})

describe('TemporalWorkerService', () => {
    // 워커가 connect → bundle → run 을 거쳐 workflow 를 실행하고 정상 종료한다
    it('runs a workflow with activities and shuts down cleanly', async () => {
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

    // init 을 호출하지 않고 destroy 만 호출해도 throw 하지 않는다
    it('is a no-op on destroy when init was never called', async () => {
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

    // workflowBundlePath 가 존재하면 그 파일을 그대로 워커에 주입한다 (production 경로)
    it('loads workflow code from workflowBundlePath when the file exists', async () => {
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

    // workflowsPath / workflowBundlePath 둘 다 없거나 잘못되면 명시적으로 throw 한다
    it('throws when neither workflowBundlePath nor workflowsPath resolves', async () => {
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

    // connection.close() 가 throw 해도 destroy 가 무사히 끝난다
    it('swallows errors when the connection close fails', async () => {
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
})

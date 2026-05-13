import type { Client, Connection } from '@temporalio/client'
import { withTestId } from '@mannercode/testing'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { TemporalClientConfig } from '../temporal.types'

/**
 * 이 파일 전체가 공유하는 단일 Connection과 Client이다.
 * 각 `it` 안의 `await import`(프로젝트 컨벤션: resetModules: true)는
 * SUT 모듈에 새로운 클래스 정체성을 부여하고, 살아 있는 인프라 핸들만 재사용한다.
 */
let connection: Connection
let client: Client
let bundlePath: string

const config = (): TemporalClientConfig => ({
    address: process.env.TESTLIB_TEMPORAL_ADDRESS as string,
    namespace: process.env.TESTLIB_TEMPORAL_NAMESPACE as string
})

beforeAll(async () => {
    const { Client, Connection } = await import('@temporalio/client')
    const { bundleWorkflowCode } = await import('@temporalio/worker')
    const { address, namespace } = config()
    connection = await Connection.connect({ address })
    client = new Client({ connection, namespace })

    const { code } = await bundleWorkflowCode({ workflowsPath: require.resolve('./workflows') })
    bundlePath = path.join(os.tmpdir(), `temporal-worker-bundle-${process.pid}.js`)
    fs.writeFileSync(bundlePath, code)
}, 60_000)

afterAll(async () => {
    await connection.close()
    fs.unlinkSync(bundlePath)
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

    it('inject로 지정한 제공자를 useFactory 인자로 전달한다', async () => {
        const { Global, Module } = await import('@nestjs/common')
        const { TemporalClientModule } = await import('../temporal-client.module')
        const { Test } = await import('@nestjs/testing')

        const ADDRESS_TOKEN = 'TEMPORAL_TEST_ADDRESS'
        const calls: string[] = []
        const { address, namespace } = config()

        // forRootAsync의 동적 모듈은 global이지만 inject 토큰은 어딘가에서
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
            // useFactory는 두 제공자(connection, client)에 연결되어 있어
            // 같은 주입 주소로 두 번 실행된다.
            expect(calls).toEqual([address, address])
        } finally {
            await moduleRef.close()
        }
    })

    it('모듈 종료 시 연결을 닫고, 닫기 실패는 무시한다', async () => {
        const { TemporalClientModule, TemporalConnectionRegistry } =
            await import('../temporal-client.module')
        const { Test } = await import('@nestjs/testing')

        const moduleRef = await Test.createTestingModule({
            imports: [
                TemporalClientModule.forRootAsync({ useFactory: () => config() }, 'destroy-test')
            ]
        }).compile()

        // close()가 거부되는 mock 연결을 레지스트리에 추가해
        // onModuleDestroy의 .catch(() => undefined) 분기를 커버한다.
        const fakeConnection = {
            close: jest.fn(async () => {
                throw new Error('boom')
            })
        }
        const registry = moduleRef.get(TemporalConnectionRegistry)
        registry.add(fakeConnection as any)

        await expect(moduleRef.close()).resolves.toBeUndefined()

        expect(fakeConnection.close).toHaveBeenCalled()
        // 종료 후 레지스트리도 비워진다.
        expect(registry.list()).toEqual([])
    })
})

describe('TemporalWorkerService', () => {
    it('워커가 번들 파일을 읽어 워크플로를 실행하고 정상 종료한다', async () => {
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
            workflowBundlePath: bundlePath
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
            workflowBundlePath: bundlePath
        })
        await expect(service.onModuleDestroy()).resolves.toBeUndefined()
    })

    it('workflowBundlePath 파일이 없으면 init에서 ENOENT를 던진다', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const { address, namespace } = config()

        const service = new TemporalWorkerService({
            activities: {},
            address,
            namespace,
            taskQueue: withTestId('worker-missing-bundle'),
            workflowBundlePath: '/tmp/this-file-definitely-does-not-exist.js'
        })

        await expect(service.onModuleInit()).rejects.toThrow(/ENOENT/)
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
            workflowBundlePath: bundlePath
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

    it('onModuleDestroy는 워커 종료를 기다린 뒤에 연결을 닫는다', async () => {
        const { TemporalWorkerService } = await import('../temporal-worker.service')
        const taskQueue = withTestId('worker-shutdown-order')
        const { address, namespace } = config()

        const service = new TemporalWorkerService({
            activities: { echo: async (msg: string) => `echo:${msg}` },
            address,
            namespace,
            taskQueue,
            workflowBundlePath: bundlePath
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
            workflowBundlePath: bundlePath
        })

        await expect(service.onModuleDestroy()).resolves.toBeUndefined()
        await expect(service.onModuleDestroy()).resolves.toBeUndefined()
    })
})

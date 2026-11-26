import { AppLoggerService } from '#common/logger'
import type { MockInstance } from 'vitest'
import {
    createEndpointHandler,
    type LogSource,
    type LoggerTransport,
    type RestateLogLevel,
    workflow
} from '@restatedev/restate-sdk'
import { once } from 'node:events'
import { type ClientHttp2Session, connect } from 'node:http2'
import { PassThrough } from 'node:stream'
import winston from 'winston'
import { RestateEndpoint } from '#common/restate'

vi.mock(import('@restatedev/restate-sdk'), async (importOriginal) => {
    const sdk = await importOriginal()
    return { ...sdk, createEndpointHandler: vi.fn(sdk.createEndpointHandler) }
})

describe('RestateEndpoint', () => {
    let logger: AppLoggerService
    let output: PassThrough
    let records: unknown[]
    beforeEach(() => {
        records = []
        output = new PassThrough({ objectMode: true })
        output.on('data', (entry) => records.push(entry))
        logger = new AppLoggerService(
            winston.createLogger({
                level: 'debug',
                transports: [new winston.transports.Stream({ stream: output })]
            })
        )
    })
    afterEach(() => {
        logger.onModuleDestroy()
        output.destroy()
    })

    describe('Restate에 등록할 workflow 주소를 지정하면', () => {
        const uri = 'http://nginx:9080'
        const adminUrl = 'http://restate:9070/'
        let request: MockInstance<typeof fetch>

        beforeEach(() => {
            request = vi.spyOn(globalThis, 'fetch')
        })
        afterEach(() => request.mockRestore())

        describe.each([201, 200])('등록 응답이 %i이면', (status) => {
            beforeEach(() => {
                request.mockResolvedValue(Response.json({ id: 'dp_123' }, { status }))
            })
            it('workflow 주소를 강제 덮어쓰기 없이 등록하고 deployment 주소를 반환한다', async () => {
                const resource = await createEndpoint().register(adminUrl, uri)
                expect(resource.href).toBe('http://restate:9070/deployments/dp_123')
                expect(request).toHaveBeenCalledWith('http://restate:9070/deployments', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ uri, force: false, use_http_11: false })
                })
            })
        })

        describe('Restate가 등록을 거부하면', () => {
            beforeEach(() => {
                request.mockResolvedValue(new Response('discovery failed', { status: 400 }))
            })
            it('등록을 시도하면 상태 코드와 실패 이유를 담은 예외를 던진다', async () => {
                await expect(createEndpoint().register(adminUrl, uri)).rejects.toThrow(
                    'Restate registration failed for http://nginx:9080 (HTTP 400): discovery failed'
                )
            })
        })

        describe('등록 응답에 deployment ID가 없으면', () => {
            beforeEach(() => {
                request.mockResolvedValue(Response.json({}))
            })
            it('등록 결과를 읽으면 누락된 필드를 담은 예외를 던진다', async () => {
                await expect(createEndpoint().register(adminUrl, uri)).rejects.toThrow('id')
            })
        })
    })

    describe('endpoint 포트가 0이고 서버를 시작하지 않았으면', () => {
        let endpoint: RestateEndpoint
        beforeEach(() => {
            endpoint = createEndpoint()
        })
        it('서버를 시작하면 사용 가능한 포트를 쓰고 종료하면 연결도 닫는다', async () => {
            await endpoint.onApplicationBootstrap()
            expect(endpoint.port).toBeGreaterThan(0)

            const client = connect(`http://127.0.0.1:${endpoint.port}`)
            await once(client, 'connect')
            const clientClosed = once(client, 'close')

            await endpoint.onApplicationShutdown()
            await clientClosed
            expect(endpoint.port).toBe(0)
        })

        it('서버를 종료해도 예외를 던지지 않는다', async () => {
            await expect(endpoint.onApplicationShutdown()).resolves.toBeUndefined()
        })

        it('시작 시 Restate 로그를 주입한 로거에 기록한다', async () => {
            try {
                await endpoint.onApplicationBootstrap()
                expect(endpoint.port).toBeGreaterThan(0)
                expect(records).toContainEqual(
                    expect.objectContaining({
                        level: 'warn',
                        message: expect.stringContaining(
                            'Accepting requests without validating request signatures'
                        ),
                        contextType: 'restate',
                        restate: expect.objectContaining({ source: 'SYSTEM' })
                    })
                )
            } finally {
                await endpoint.onApplicationShutdown()
            }
        })
    })

    describe('HTTP/2 요청이 응답을 기다리는 동안', () => {
        let endpoint: RestateEndpoint
        let client: ClientHttp2Session
        beforeEach(async () => {
            const received = Promise.withResolvers<void>()
            vi.mocked(createEndpointHandler).mockReturnValueOnce(() => received.resolve())
            endpoint = createEndpoint()
            await endpoint.onApplicationBootstrap()
            client = connect(`http://127.0.0.1:${endpoint.port}`)
            client.request({ ':path': '/' }).end()
            await received.promise
        })
        afterEach(async () => {
            vi.useRealTimers()
            client?.destroy()
            await endpoint?.onApplicationShutdown()
        })
        it('종료를 요청하면 연결을 최대 5초 기다린 뒤 강제로 닫는다', async () => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
            const closed = once(client, 'close')
            const draining = once(client, 'goaway')
            const shutdown = endpoint.onApplicationShutdown()
            await draining
            await vi.advanceTimersByTimeAsync(4_999)
            expect(client.destroyed).toBe(false)
            await vi.advanceTimersByTimeAsync(1)
            await Promise.all([shutdown, closed])
            expect(client.destroyed).toBe(true)
            expect(endpoint.port).toBe(0)
        })
    })

    describe('애플리케이션 로거를 연결했으면', () => {
        let transport: LoggerTransport
        let endpoint: RestateEndpoint
        beforeEach(async () => {
            endpoint = createEndpoint()
            await endpoint.onApplicationBootstrap()
            transport = vi.mocked(createEndpointHandler).mock.lastCall![0].logger!
        })
        afterEach(() => endpoint.onApplicationShutdown())
        describe.each([
            ['trace', 'verbose'],
            ['debug', 'debug'],
            ['info', 'info'],
            ['warn', 'warn'],
            ['error', 'error']
        ] as const)('로그 레벨이 %s이면', (level, outputLevel) => {
            let metadata: Parameters<LoggerTransport>[0]
            beforeEach(() => {
                metadata = {
                    level: level as RestateLogLevel,
                    replaying: false,
                    source: 'USER' as LogSource
                }
            })
            it(`로그를 전달하면 ${outputLevel} 수준으로 메시지와 상세 내용을 기록한다`, () => {
                const message = `${level} message`
                transport(metadata, message, `${level} detail`)
                expect(records).toContainEqual(
                    expect.objectContaining({
                        level: outputLevel,
                        message,
                        parameters: [`${level} detail`]
                    })
                )
            })
        })
    })

    function createEndpoint(servicePort = 0) {
        const definition = workflow({
            handlers: { run: async () => undefined },
            name: `EndpointTest-${Math.random().toString(36).slice(2)}`
        })
        return new RestateEndpoint([definition], servicePort, logger)
    }
})

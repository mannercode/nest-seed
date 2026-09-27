import type { AppLoggerService } from '../../index.js'
import { type LoggerTransport, workflow } from '@restatedev/restate-sdk'
import { once } from 'node:events'
import { connect } from 'node:http2'
import { RestateEndpoint } from '../index.js'

describe('RestateEndpoint', () => {
    describe('endpoint 포트가 0이고 서버를 시작하지 않았으면', () => {
        let endpoint: RestateEndpoint
        let logger: AppLoggerService
        beforeEach(() => {
            logger = createLogger()
            endpoint = createEndpoint(0, logger)
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
                expect(logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(
                        'Accepting requests without validating request signatures'
                    ),
                    expect.objectContaining({
                        contextType: 'restate',
                        restate: expect.objectContaining({ source: 'SYSTEM' })
                    })
                )
            } finally {
                await endpoint.onApplicationShutdown()
            }
        })
    })

    describe('연결을 강제로 닫기 전까지 서버 종료가 끝나지 않도록 설정하면', () => {
        let endpoint: RestateEndpoint
        let session: { close: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }
        beforeEach(() => {
            vi.useFakeTimers()
            endpoint = createEndpoint()
            let finishServerClose!: () => void
            session = { close: vi.fn(), destroy: vi.fn(() => finishServerClose()) }
            const server = {
                close: vi.fn((done: () => void) => {
                    finishServerClose = done
                })
            }
            const internals = endpoint as unknown as {
                server: typeof server
                sessions: Set<typeof session>
            }
            internals.server = server
            internals.sessions.add(session)
        })
        it('종료를 요청하고 5초가 지나면 남은 연결을 강제로 닫는다', async () => {
            try {
                const shutdown = endpoint.onApplicationShutdown()
                expect(session.close).toHaveBeenCalledTimes(1)
                await vi.advanceTimersByTimeAsync(5_000)
                await shutdown
                expect(session.destroy).toHaveBeenCalledTimes(1)
            } finally {
                vi.useRealTimers()
            }
        })
    })

    describe('애플리케이션 로거를 연결했으면', () => {
        let logger: AppLoggerService
        let transport: LoggerTransport
        beforeEach(() => {
            logger = createLogger()
            const endpoint = createEndpoint(9080, logger)
            transport = (endpoint as unknown as { restateLogger: LoggerTransport }).restateLogger
        })
        describe.each([
            ['trace', 'verbose'],
            ['debug', 'debug'],
            ['info', 'log'],
            ['warn', 'warn'],
            ['error', 'error']
        ] as const)('로그 레벨이 %s이면', (level, loggerMethod) => {
            let metadata: Parameters<LoggerTransport>[0]
            beforeEach(() => {
                metadata = {
                    level,
                    replaying: false,
                    source: 'USER'
                } as unknown as Parameters<LoggerTransport>[0]
            })
            it(`로그를 전달하면 로거의 ${loggerMethod} 메서드를 호출한다`, () => {
                const message = `${level} message`
                transport(metadata, message, `${level} detail`)
                expect(logger[loggerMethod]).toHaveBeenCalledWith(
                    message,
                    expect.objectContaining({ parameters: [`${level} detail`] })
                )
            })
        })
    })

    function createEndpoint(servicePort = 0, logger = createLogger()) {
        const definition = workflow({
            handlers: { run: async () => undefined },
            name: `EndpointTest-${Math.random().toString(36).slice(2)}`
        })
        return new RestateEndpoint([definition], servicePort, logger)
    }

    function createLogger() {
        return {
            debug: vi.fn(),
            error: vi.fn(),
            log: vi.fn(),
            verbose: vi.fn(),
            warn: vi.fn()
        } as unknown as AppLoggerService
    }
})

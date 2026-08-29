import type { AppLoggerService } from '@mannercode/common'
import { type LoggerTransport, workflow } from '@restatedev/restate-sdk'
import { once } from 'node:events'
import { connect } from 'node:http2'
import type { AppConfigService } from '#config'
import type { ShowtimeCreationWorkflow } from '../workflow.js'
import { ShowtimeCreationRestateEndpoint } from '../restate-endpoint.service.js'

describe('ShowtimeCreationRestateEndpoint', () => {
    it('Vitest에서는 임의 포트로 열고 HTTP/2 session까지 정상 종료한다', async () => {
        const endpoint = createEndpoint()
        await endpoint.onApplicationBootstrap()
        expect(endpoint.port).toBeGreaterThan(0)

        const client = connect(`http://127.0.0.1:${endpoint.port}`)
        await once(client, 'connect')
        const clientClosed = once(client, 'close')

        await endpoint.onApplicationShutdown()
        await clientClosed
        expect(endpoint.port).toBe(0)
    })

    it('시작하지 않은 endpoint 종료는 그대로 끝난다', async () => {
        await expect(createEndpoint().onApplicationShutdown()).resolves.toBeUndefined()
    })

    it('Vitest 밖에서는 설정 포트를 사용한다', async () => {
        const workerId = process.env.VITEST_POOL_ID
        delete process.env.VITEST_POOL_ID
        const logger = createLogger()
        const endpoint = createEndpoint(0, logger)

        try {
            await endpoint.onApplicationBootstrap()
            expect(endpoint.port).toBeGreaterThan(0)
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Accepting requests without validating request signatures'),
                expect.objectContaining({
                    contextType: 'restate',
                    restate: expect.objectContaining({ source: 'SYSTEM' })
                })
            )
        } finally {
            await endpoint.onApplicationShutdown()
            process.env.VITEST_POOL_ID = workerId
        }
    })

    it('graceful close가 끝나지 않으면 5초 뒤 남은 session을 강제 종료한다', async () => {
        vi.useFakeTimers()
        const endpoint = createEndpoint()
        let finishServerClose!: () => void
        const session = { close: vi.fn(), destroy: vi.fn(() => finishServerClose()) }
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

    it('Restate 로그 레벨을 애플리케이션 로거에 대응시킨다', () => {
        const logger = createLogger()
        const endpoint = createEndpoint(9080, logger)
        const transport = (endpoint as unknown as { restateLogger: LoggerTransport }).restateLogger
        const mappings = [
            ['trace', 'verbose'],
            ['debug', 'debug'],
            ['info', 'log'],
            ['warn', 'warn'],
            ['error', 'error']
        ] as const

        for (const [level, loggerMethod] of mappings) {
            const message = `${level} message`
            transport(
                {
                    level,
                    replaying: false,
                    source: 'USER'
                } as unknown as Parameters<LoggerTransport>[0],
                message,
                `${level} detail`
            )

            expect(logger[loggerMethod]).toHaveBeenCalledWith(
                message,
                expect.objectContaining({ parameters: [`${level} detail`] })
            )
        }
    })

    function createEndpoint(servicePort = 9080, logger = createLogger()) {
        const definition = workflow({
            handlers: { run: async () => undefined },
            name: `EndpointTest-${Math.random().toString(36).slice(2)}`
        })
        const workflowProvider = { definition } as ShowtimeCreationWorkflow
        const config = { restate: { servicePort } } as AppConfigService
        return new ShowtimeCreationRestateEndpoint(workflowProvider, config, logger)
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

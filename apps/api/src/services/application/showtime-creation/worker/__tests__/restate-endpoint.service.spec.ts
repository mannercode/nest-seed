import type { AppConfigService } from 'config'
import { workflow } from '@restatedev/restate-sdk'
import { once } from 'node:events'
import { connect } from 'node:http2'
import type { ShowtimeCreationWorkflow } from '../workflow'
import { ShowtimeCreationRestateEndpoint } from '../restate-endpoint.service'

describe('ShowtimeCreationRestateEndpoint', () => {
    it('Jest에서는 임의 포트로 열고 HTTP/2 session까지 정상 종료한다', async () => {
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

    it('Jest 밖에서는 설정 포트를 사용한다', async () => {
        const workerId = process.env.JEST_WORKER_ID
        delete process.env.JEST_WORKER_ID
        jest.spyOn(console, 'warn').mockImplementation()
        const endpoint = createEndpoint(0)

        try {
            await endpoint.onApplicationBootstrap()
            expect(endpoint.port).toBeGreaterThan(0)
        } finally {
            await endpoint.onApplicationShutdown()
            process.env.JEST_WORKER_ID = workerId
        }
    })

    it('graceful close가 끝나지 않으면 5초 뒤 남은 session을 강제 종료한다', async () => {
        jest.useFakeTimers()
        const endpoint = createEndpoint()
        let finishServerClose!: () => void
        const session = { close: jest.fn(), destroy: jest.fn(() => finishServerClose()) }
        const server = {
            close: jest.fn((done: () => void) => {
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
            await jest.advanceTimersByTimeAsync(5_000)
            await shutdown
            expect(session.destroy).toHaveBeenCalledTimes(1)
        } finally {
            jest.useRealTimers()
        }
    })

    function createEndpoint(servicePort = 9080) {
        const definition = workflow({
            handlers: { run: async () => undefined },
            name: `EndpointTest-${Math.random().toString(36).slice(2)}`
        })
        const workflowProvider = { definition } as ShowtimeCreationWorkflow
        const config = { restate: { servicePort } } as AppConfigService
        return new ShowtimeCreationRestateEndpoint(workflowProvider, config)
    }
})

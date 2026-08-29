import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { createEndpointHandler } from '@restatedev/restate-sdk'
import { createServer, type Http2Server, type ServerHttp2Session } from 'node:http2'
import { AppConfigService } from '#config'
import { ShowtimeCreationWorkflow } from './workflow.js'

@Injectable()
export class ShowtimeCreationRestateEndpoint
    implements OnApplicationBootstrap, OnApplicationShutdown
{
    private boundPort = 0
    private server?: Http2Server
    private readonly sessions = new Set<ServerHttp2Session>()

    constructor(
        private readonly workflow: ShowtimeCreationWorkflow,
        private readonly config: AppConfigService
    ) {}

    get port() {
        return this.boundPort
    }

    async onApplicationBootstrap() {
        const handler = createEndpointHandler({
            logger: process.env.VITEST_POOL_ID ? () => undefined : undefined,
            services: [this.workflow.definition]
        })
        const server = createServer(handler)
        this.server = server

        server.on('session', (session) => {
            this.sessions.add(session)
            session.once('close', () => this.sessions.delete(session))
        })

        await new Promise<void>((resolve, reject) => {
            server.once('error', reject)
            server.listen(this.testPortOrConfiguredPort(), '0.0.0.0', () => {
                server.off('error', reject)
                resolve()
            })
        })

        this.boundPort = (server.address() as { port: number }).port

        // 시작 이후 HTTP/2 server의 error listener는 일부러 두지 않는다. 서버 오류로
        // 프로세스가 종료되면 Restate가 invocation을 다른 복제본에서 재시도한다.
    }

    async onApplicationShutdown() {
        const server = this.server
        this.server = undefined
        if (!server) return

        const closed = new Promise<void>((resolve) => server.close(() => resolve()))
        this.sessions.forEach((session) => session.close())
        const forceClose = setTimeout(() => {
            this.sessions.forEach((session) => session.destroy())
        }, 5_000)
        await closed
        clearTimeout(forceClose)
        this.sessions.clear()
        this.boundPort = 0
    }

    private testPortOrConfiguredPort() {
        return process.env.VITEST_POOL_ID ? 0 : this.config.restate.servicePort
    }
}

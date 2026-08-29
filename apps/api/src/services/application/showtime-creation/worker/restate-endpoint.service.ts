import { AppLoggerService } from '@mannercode/common'
import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import {
    createEndpointHandler,
    type LoggerTransport,
    type RestateLogLevel
} from '@restatedev/restate-sdk'
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
        private readonly config: AppConfigService,
        private readonly logger: AppLoggerService
    ) {}

    get port() {
        return this.boundPort
    }

    async onApplicationBootstrap() {
        const handler = createEndpointHandler({
            // Restate의 재시도 로그는 통합 테스트 출력량을 크게 늘리므로 테스트에서는 끈다.
            logger: process.env.VITEST_POOL_ID ? () => undefined : this.restateLogger,
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

    private readonly restateLogger: LoggerTransport = (
        { context, level, replaying, source },
        message,
        ...optionalParams
    ) => {
        const details = {
            contextType: 'restate',
            restate: {
                handlerName: context?.handlerName,
                invocationId: context?.invocationId,
                key: context?.key,
                replaying,
                serviceName: context?.serviceName,
                source
            },
            ...(optionalParams.length > 0 ? { parameters: optionalParams } : {})
        }

        this.restateLoggers[level](message, details)
    }

    private readonly restateLoggers: Record<
        RestateLogLevel,
        (message: unknown, details: Record<string, unknown>) => void
    > = {
        debug: (message, details) => this.logger.debug(message, details),
        error: (message, details) => this.logger.error(message, details),
        info: (message, details) => this.logger.log(message, details),
        trace: (message, details) => this.logger.verbose(message, details),
        warn: (message, details) => this.logger.warn(message, details)
    }
}

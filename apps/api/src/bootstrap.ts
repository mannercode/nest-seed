import { AppLoggerService } from '@mannercode/common'
import { NestFactory } from '@nestjs/core'
import compression from 'compression'
import express from 'express'
import { hostname } from 'os'
import { AppConfigService } from '#config'
import { AppModule } from './app.module.js'
import { configureTemporalJson } from './configure-temporal-json.js'

export async function bootstrap() {
    // Nest 초기화 로그도 ECS stdout 계약을 따르도록 로거 준비 전까지 버퍼링한다.
    const app = await NestFactory.create(AppModule, { bufferLogs: true })
    const { http } = app.get(AppConfigService)
    const logger = app.get(AppLoggerService)
    app.useLogger(logger)

    // 외부가 보낸 X-Forwarded-For는 NGINX가 실제 원격 주소를 뒤에 붙인다.
    // 사설 프록시 홉만 신뢰하면 Express가 오른쪽부터 첫 외부 주소를 클라이언트 IP로 고른다.
    const expressApp = app.getHttpAdapter().getInstance()
    expressApp.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])
    configureTemporalJson(app)

    // Docker hostname을 노출해 분산 테스트에서 응답한 복제본을 식별한다.
    const replicaId = hostname()
    app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.setHeader('x-replica-id', replicaId)
        next()
    })

    app.use(compression())
    app.use(express.json({ limit: http.requestPayloadLimit }))

    app.enableShutdownHooks()

    const server = await app.listen(http.port)
    // NGINX가 60초에 upstream 유휴 연결을 먼저 닫도록 Node keep-alive를 65초로 둔다.
    server.keepAliveTimeout = 65_000
    server.headersTimeout = 66_000

    logger.log('Application is running', { url: await app.getUrl() })
}

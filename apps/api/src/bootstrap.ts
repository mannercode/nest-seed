import { AppLoggerService, PathUtil } from '@mannercode/common'
import { NestFactory } from '@nestjs/core'
import compression from 'compression'
import { AppConfigService } from 'config'
import express from 'express'
import { hostname } from 'os'
import { exit } from 'process'
import { AppModule } from './app.module'

export async function bootstrap() {
    const app = await NestFactory.create(AppModule)
    const { http, log } = app.get(AppConfigService)

    // 외부가 보낸 X-Forwarded-For는 NGINX가 실제 원격 주소를 뒤에 붙인다.
    // 사설 프록시 홉만 신뢰하면 Express가 오른쪽부터 첫 외부 주소를 클라이언트 IP로 고른다.
    app.getHttpAdapter().getInstance().set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])

    await PathUtil.mkdir(log.directory)

    if (!(await PathUtil.isWritable(log.directory))) {
        console.error(`Error: Directory is not writable: '${log.directory}'`)
        exit(1)
    }

    // Docker hostname을 노출해 분산 테스트에서 응답한 복제본을 식별한다.
    const replicaId = hostname()
    app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.setHeader('x-replica-id', replicaId)
        next()
    })

    app.use(compression())
    app.use(express.json({ limit: http.requestPayloadLimit }))

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)

    app.enableShutdownHooks()

    const server = await app.listen(http.port)
    // NGINX가 60초에 upstream 유휴 연결을 먼저 닫도록 Node keep-alive를 65초로 둔다.
    server.keepAliveTimeout = 65_000
    server.headersTimeout = 66_000

    console.log(`Application is running on: ${await app.getUrl()}`)
}

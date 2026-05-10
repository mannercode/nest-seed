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

    await PathUtil.mkdir(log.directory)

    if (!(await PathUtil.isWritable(log.directory))) {
        console.error(`Error: Directory is not writable: '${log.directory}'`)
        exit(1)
    }

    // 분산 부하 테스트용 복제본 식별자. docker 에선 hostname 이 컨테이너 id 라
    // 복제본마다 유일하다. 노출돼도 안전 — docker ps / nginx 상류에서 어차피
    // 보이는 정보다.
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
    // 유휴 상류 연결을 nginx 풀 타임아웃(기본 60초) 보다 길게 살려둬서, nginx 가
    // Node 가 이미 닫은 연결을 재사용하려다 클라이언트에 502 를 내는 일이 없도록 한다.
    server.keepAliveTimeout = 65_000
    server.headersTimeout = 66_000

    console.log(`Application is running on: ${await app.getUrl()}`)
}

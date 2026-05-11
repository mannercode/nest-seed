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

    // 복제본을 구별하기 위한 식별자. docker 환경에서는 hostname 이 컨테이너
    // id 와 같아서 복제본마다 다른 값이 나온다. 분산 부하 테스트가 어느
    // 복제본이 응답했는지 볼 때 쓴다. `docker ps` 와 nginx upstream 로그에
    // 이미 같은 값이 보이므로 외부 노출은 따로 위험하지 않다.
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
    // 유휴 상류 연결을 nginx keep-alive 풀의 60초보다 길게 살려 둔다.
    // 같지 않으면 nginx 가 이미 Node 쪽에서 닫힌 연결을 다시 쓰려다 502 를
    // 낸다.
    server.keepAliveTimeout = 65_000
    server.headersTimeout = 66_000

    console.log(`Application is running on: ${await app.getUrl()}`)
}

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

    // 복제본을 구별하기 위한 식별자이다. Docker 환경에서는 hostname이 컨테이너
    // ID와 같아서 복제본마다 다른 값이 나온다. 분산 부하 테스트에서 어느 복제본이
    // 응답했는지 확인할 때 사용한다. `docker ps`와 NGINX upstream 로그에 이미
    // 같은 값이 보이므로 외부에 노출해도 추가 위험은 작다.
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
    // NGINX upstream keep-alive 풀(60초)보다 Node 서버의 유휴 타임아웃을 길게 둔다.
    // Node가 먼저 연결을 닫으면 NGINX가 풀에 남아 있던 소켓을 재사용하다 502를
    // 반환할 수 있다.
    server.keepAliveTimeout = 65_000
    server.headersTimeout = 66_000

    console.log(`Application is running on: ${await app.getUrl()}`)
}

import type { Model } from 'mongoose'
import { AppLoggerService, isDuplicateKeyError, PathUtil } from '@mannercode/common'
import { NestFactory } from '@nestjs/core'
import { getModelToken } from '@nestjs/mongoose'
import compression from 'compression'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { Admin, AdminsService } from 'core'
import express from 'express'
import { hostname } from 'os'
import { exit } from 'process'
import { AppModule } from './app.module'

// dev 환경 부팅 시 콘솔 진입용 시드 admin을 만들어 둔다. 운영 빌드에서는
// 절대 동작하면 안 되므로 NODE_ENV로 막는다.
//
// Mongoose의 autoIndex는 백그라운드로 돌기 때문에, 멀티 레플리카가 동시에
// 부팅하면 unique 이메일 인덱스가 아직 없는 사이에 모두 같은 시드 도큐먼트를
// insert해버린다. 그 뒤 인덱스 빌드가 E11000으로 깨져 프로세스가 죽는다.
// `Model.init()`으로 인덱스가 깔린 걸 먼저 기다린 뒤 시드를 시도하면,
// 두 번째부터의 insert는 unique 제약에 걸려 E11000이 나오고 아래 catch가
// 무시한다.
const DEV_ADMIN_EMAIL = 'admin@nest-seed.local'
const DEV_ADMIN_NAME = 'Dev Admin'
const DEV_ADMIN_PASSWORD = 'DevPass1!'

async function seedDevAdmin(adminsService: AdminsService, adminsModel: Model<Admin>) {
    await adminsModel.init()

    try {
        await adminsService.create({
            email: DEV_ADMIN_EMAIL,
            name: DEV_ADMIN_NAME,
            password: DEV_ADMIN_PASSWORD
        })
    } catch (error) {
        if (isDuplicateKeyError(error)) return
        throw error
    }
}

export async function bootstrap() {
    const app = await NestFactory.create(AppModule)
    const { http, log } = app.get(AppConfigService)

    // dev seed는 NODE_ENV가 production이 아닐 때 자동, production에서도 `SEED_DEV_ADMIN=true`로
    // 명시한 환경에서만 동작한다. api-docs(deploy/compose.yml)처럼 production 모드로 띄우되 admin
    // 로그인이 필요한 환경을 위해 둔 가드다.
    if (process.env.NODE_ENV !== 'production' || process.env.SEED_DEV_ADMIN === 'true') {
        const adminsModel = app.get<Model<Admin>>(getModelToken(Admin.name, MONGO_CONNECTION_NAME))
        await seedDevAdmin(app.get(AdminsService), adminsModel)
    }

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

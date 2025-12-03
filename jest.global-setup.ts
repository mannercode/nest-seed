import { NatsContainer } from '@testcontainers/nats'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { GenericContainer, StartedTestContainer } from 'testcontainers'

type TestInfra = {
    mongod: MongoMemoryReplSet
    redis: StartedTestContainer
    nats: StartedTestContainer
    minio: StartedTestContainer
}

export default async function globalSetup() {
    const nats = await new NatsContainer('nats:2').start()
    process.env.NATS_OPTIONS = JSON.stringify(nats.getConnectionOptions())

    const mongod = await MongoMemoryReplSet.create({
        instanceOpts: [
            {
                /**
                 * MongoDB configuration for testing the Mongoose `expires` option.
                 * The default TTL monitor interval is 60 seconds, which is too long
                 * for tests using values like `expires: '500ms'`.
                 * We start a replica set with `ttlMonitorSleepSecs=1` so TTL expiration
                 * is processed quickly during tests.
                 *
                 * TTL(expire) 옵션 테스트용 MongoDB 설정.
                 * 기본 TTL 모니터 주기는 60초라,
                 * `expires: '500ms'` 같은 스키마 옵션이 바로 적용되지 않는다.
                 * 테스트를 빠르게 돌리기 위해 TTL 모니터 주기를 1초로 줄어든 레플리카셋을 띄운다.
                 *
                 * @NestSchema()
                 * export class ExpireSample extends MongooseSchema {
                 *   @Prop({ expires: '500ms', default: Date.now })
                 *   expiresAt: Date
                 * }
                 */
                args: ['--setParameter', 'ttlMonitorSleepSecs=1']
            }
        ]
    })

    const redis = await new GenericContainer('redis:7').withExposedPorts(6379).start()
    process.env.REDIS_URL = `redis://localhost:${redis.getMappedPort(6379)}`

    process.env.MINIO_ACCESS_KEY = 'access'
    process.env.MINIO_SECRET_KEY = 'secret'

    const minio = await new GenericContainer('minio/minio')
        .withEnvironment({
            MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
            MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY
        })
        .withCommand(['server', '/data'])
        .withExposedPorts(9000)
        .start()

    process.env.MINIO_ENDPOINT = `http://localhost:${minio.getMappedPort(9000)}`
    ;(globalThis as any).__TEST_INFRA__ = { mongod, redis, nats, minio } as TestInfra
}

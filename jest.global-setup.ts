import { NatsContainer } from '@testcontainers/nats'
import dotenv from 'dotenv'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { GenericContainer } from 'testcontainers'

function getEnv(key: string) {
    const value = process.env[key]

    if (!value) throw new Error(`Environment variable ${key} is not defined`)

    return value
}

async function setupNats() {
    return new NatsContainer(getEnv('NATS_IMAGE')).start()
}

async function setupRedis() {
    return new GenericContainer(getEnv('REDIS_IMAGE')).withExposedPorts(6379).start()
}

async function setupMongo() {
    const version = getEnv('MONGO_IMAGE').split(':')[1]

    return MongoMemoryReplSet.create({
        binary: { version },
        instanceOpts: [
            {
                /**
                 * MongoDB for TTL(expire) tests – ttlMonitorSleepSecs=1 for fast TTL expiry.
                 * TTL(expire) 테스트용 MongoDB – TTL 모니터 주기를 1초로 줄여 빠르게 만료 확인.
                 *
                 * @NestSchema()
                 * export class ExpireSample extends MongooseSchema {
                 *     @Prop({ expires: '500ms'})
                 *     expiresAt: Date
                 * }
                 */
                args: ['--setParameter', 'ttlMonitorSleepSecs=1']
            }
        ]
    })
}

async function setupMinio() {
    const MINIO_ROOT_USER = 'user'
    const MINIO_ROOT_PASSWORD = 'password'

    const minio = new GenericContainer(getEnv('MINIO_IMAGE'))
        .withEnvironment({ MINIO_ROOT_USER, MINIO_ROOT_PASSWORD })
        .withCommand(['server', '/data'])
        .withExposedPorts(9000)
        .start()

    process.env.COMMONLIB_MINIO_ACCESS_KEY = MINIO_ROOT_USER
    process.env.COMMONLIB_MINIO_SECRET_KEY = MINIO_ROOT_PASSWORD

    return minio
}

export default async function globalSetup() {
    dotenv.config({ path: ['.env.infra'], quiet: true })
    process.env.NODE_ENV = 'test'

    const [nats, mongo, redis, minio] = await Promise.all([
        setupNats(),
        setupMongo(),
        setupRedis(),
        setupMinio()
    ])

    ;(globalThis as any).__TEST_INFRA__ = { mongo, redis, nats, minio }

    // TODO 이거 받아오는 공통 로직 필요?
    process.env.COMMONLIB_NATS_OPTIONS = JSON.stringify(nats.getConnectionOptions())
    process.env.COMMONLIB_MONGO_URI = mongo.getUri()
    process.env.COMMONLIB_REDIS_URL = `redis://localhost:${redis.getMappedPort(6379)}`
    process.env.COMMONLIB_MINIO_ENDPOINT = `http://localhost:${minio.getMappedPort(9000)}`
}

import { MongoDBContainer } from '@testcontainers/mongodb'
import { NatsContainer } from '@testcontainers/nats'
import dotenv from 'dotenv'
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
    return await new MongoDBContainer(getEnv('MONGO_IMAGE')).start()
}

async function setupMinio() {
    const MINIO_ROOT_USER = 'user'
    const MINIO_ROOT_PASSWORD = 'password'

    const minio = new GenericContainer(getEnv('MINIO_IMAGE'))
        .withEnvironment({ MINIO_ROOT_USER, MINIO_ROOT_PASSWORD })
        .withCommand(['server', '/data'])
        .withExposedPorts(9000)
        .start()

    process.env.TESTLIB_S3_ACCESS_KEY = MINIO_ROOT_USER
    process.env.TESTLIB_S3_SECRET_KEY = MINIO_ROOT_PASSWORD

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

    process.env.TESTLIB_NATS_OPTIONS = JSON.stringify(nats.getConnectionOptions())
    // MongoServerSelectionError: getaddrinfo ENOTFOUND 28f6974a84e2 같은 에러를 방지하기 위해 directConnection 사용
    // Use directConnection to prevent MongoServerSelectionError: getaddrinfo ENOTFOUND on container hostnames
    process.env.TESTLIB_MONGO_URI = `${mongo.getConnectionString()}?directConnection=true`
    process.env.TESTLIB_REDIS_URL = `redis://localhost:${redis.getMappedPort(6379)}`
    process.env.TESTLIB_S3_ENDPOINT = `http://localhost:${minio.getMappedPort(9000)}`
}

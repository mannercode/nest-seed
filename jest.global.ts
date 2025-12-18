import { MongoDBContainer } from '@testcontainers/mongodb'
import { NatsContainer } from '@testcontainers/nats'
import fs from 'fs'
import { GenericContainer } from 'testcontainers'
import { getEnv, setEnv } from './jest.utils'

async function setupNats() {
    return new NatsContainer(getEnv('NATS_IMAGE')).withName('testlib-nats').withReuse().start()
}

async function setupRedis() {
    return new GenericContainer(getEnv('REDIS_IMAGE'))
        .withName('testlib-redis')
        .withExposedPorts(6379)
        .withReuse()
        .start()
}

async function setupMongo() {
    return new MongoDBContainer(getEnv('MONGO_IMAGE')).withName('testlib-mongo').withReuse().start()
}

async function setupMinio() {
    const MINIO_ROOT_USER = 'user'
    const MINIO_ROOT_PASSWORD = 'password'
    setEnv('TESTLIB_S3_ACCESS_KEY', MINIO_ROOT_USER)
    setEnv('TESTLIB_S3_SECRET_KEY', MINIO_ROOT_PASSWORD)

    return new GenericContainer(getEnv('MINIO_IMAGE'))
        .withEnvironment({ MINIO_ROOT_USER, MINIO_ROOT_PASSWORD })
        .withCommand(['server', '/data'])
        .withExposedPorts(9000)
        .withName('testlib-minio')
        .withReuse()
        .start()
}

export default async function globalSetup() {
    const dirPath = getEnv('LOG_DIRECTORY')
    fs.mkdirSync(dirPath, { recursive: true })

    const [nats, mongo, redis, minio] = await Promise.all([
        setupNats(),
        setupMongo(),
        setupRedis(),
        setupMinio()
    ])

    ;(globalThis as any).__TEST_INFRA__ = { mongo, redis, nats, minio }

    setEnv('TESTLIB_NATS_OPTIONS', JSON.stringify(nats.getConnectionOptions()))
    // Use directConnection to prevent MongoServerSelectionError: getaddrinfo ENOTFOUND on container hostnames
    // MongoServerSelectionError: getaddrinfo ENOTFOUND 28f6974a84e2 같은 에러를 방지하기 위해 directConnection 사용
    setEnv('TESTLIB_MONGO_URI', `${mongo.getConnectionString()}?directConnection=true`)
    setEnv('TESTLIB_REDIS_URL', `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`)
    setEnv('TESTLIB_S3_ENDPOINT', `http://${minio.getHost()}:${minio.getMappedPort(9000)}`)
}

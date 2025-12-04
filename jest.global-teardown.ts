import type { StartedTestContainer } from 'testcontainers'

type TestInfra = {
    mongo: StartedTestContainer
    redis: StartedTestContainer
    nats: StartedTestContainer
    minio: StartedTestContainer
}

export default async function globalTeardown() {
    const { mongo, redis, nats, minio } = (globalThis as any).__TEST_INFRA__ as TestInfra

    await Promise.all([mongo.stop(), redis.stop(), nats.stop(), minio.stop()])
}

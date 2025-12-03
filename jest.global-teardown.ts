// test/global-teardown.ts
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { StartedTestContainer } from 'testcontainers'

type TestInfra = {
    mongod: MongoMemoryReplSet
    redis: StartedTestContainer
    nats: StartedTestContainer
    minio: StartedTestContainer
}

export default async function globalTeardown() {
    const infra = (globalThis as any).__TEST_INFRA__ as TestInfra | undefined
    if (!infra) return

    await infra.mongod.stop()
    await infra.redis.stop()
    await infra.nats.stop()
    await infra.minio.stop()
}

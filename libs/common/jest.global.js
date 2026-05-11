const { GenericContainer } = require('testcontainers')
const { MongoDBContainer } = require('@testcontainers/mongodb')
const { NatsContainer } = require('@testcontainers/nats')
const { TestWorkflowEnvironment } = require('@temporalio/testing')

module.exports = async function globalSetup() {
    const [mongo, redis, minio, nats, temporalEnv] = await Promise.all([
        new MongoDBContainer(process.env.MONGO_IMAGE)
            .withCommand(['--replSet', 'rs0', '--bind_ip_all', '--wiredTigerCacheSizeGB', '0.25'])
            .withResourcesQuota({ memory: 1 })
            .start(),

        new GenericContainer(process.env.REDIS_IMAGE)
            .withExposedPorts(6379)
            .withResourcesQuota({ memory: 0.125 })
            .start(),

        new GenericContainer(process.env.MINIO_IMAGE)
            .withExposedPorts(9000)
            .withEnvironment({ MINIO_ROOT_USER: 'admin', MINIO_ROOT_PASSWORD: 'password' })
            .withCommand(['server', '/data'])
            .withResourcesQuota({ memory: 0.5 })
            .start(),

        new NatsContainer(process.env.NATS_IMAGE)
            .withJetStream()
            .withResourcesQuota({ memory: 0.25 })
            .start(),

        TestWorkflowEnvironment.createLocal()
    ])

    process.env.TESTLIB_MONGO_URI = `${mongo.getConnectionString()}?directConnection=true`
    process.env.TESTLIB_REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`
    process.env.TESTLIB_S3_ENDPOINT = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`
    process.env.TESTLIB_S3_ACCESS_KEY = 'admin'
    process.env.TESTLIB_S3_SECRET_KEY = 'password'
    // `NatsContainer` 는 기본으로 사용자/비밀번호 인증을 강제한다. 이 값을
    // 받는 쪽이 그 사실을 따로 챙기지 않도록, 연결 옵션 전체를 그대로
    // 넘긴다.
    process.env.TESTLIB_NATS_OPTIONS = JSON.stringify(nats.getConnectionOptions())
    process.env.TESTLIB_TEMPORAL_ADDRESS = temporalEnv.address
    process.env.TESTLIB_TEMPORAL_NAMESPACE = temporalEnv.namespace ?? 'default'

    // jest 의 `globalSetup` 과 `globalTeardown` 은 같은 프로세스에서 돈다.
    // 그래서 띄운 인스턴스를 `globalThis` 에 두고 teardown 에서 다시 꺼내
    // 닫는다.
    globalThis.__TEMPORAL_TEST_ENV__ = temporalEnv
}

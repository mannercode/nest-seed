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

        // @temporalio/testing 의 ephemeral test server (Temporal CLI binary).
        // 기존 testcontainer (postgres + auto-setup, ~30s 첫 부팅) 대신 in-process
        // child binary 로 수초 내 부팅. auto-setup deprecation 도 회피.
        TestWorkflowEnvironment.createLocal()
    ])

    process.env.TESTLIB_MONGO_URI = `${mongo.getConnectionString()}?directConnection=true`
    process.env.TESTLIB_REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`
    process.env.TESTLIB_S3_ENDPOINT = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`
    process.env.TESTLIB_S3_ACCESS_KEY = 'admin'
    process.env.TESTLIB_S3_SECRET_KEY = 'password'
    // NatsContainer 는 기본적으로 user/pass auth 를 강제한다. consumer 가
    // 신경 쓰지 않도록 connection option 을 전체로 전달한다.
    process.env.TESTLIB_NATS_OPTIONS = JSON.stringify(nats.getConnectionOptions())
    process.env.TESTLIB_TEMPORAL_ADDRESS = temporalEnv.address
    process.env.TESTLIB_TEMPORAL_NAMESPACE = temporalEnv.namespace ?? 'default'

    // jest globalSetup / globalTeardown 은 같은 process 에서 실행되므로
    // globalThis 로 instance 공유. teardown 에서 ephemeral server child
    // process 정리.
    globalThis.__TEMPORAL_TEST_ENV__ = temporalEnv
}

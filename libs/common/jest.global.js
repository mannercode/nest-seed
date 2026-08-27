const { GenericContainer, Wait } = require('testcontainers')
const { MongoDBContainer } = require('@testcontainers/mongodb')
const { NatsContainer } = require('@testcontainers/nats')
const { TestWorkflowEnvironment } = require('@temporalio/testing')

module.exports = async function globalSetup() {
    const [mongo, redis, s3, nats, temporalEnv] = await Promise.all([
        new MongoDBContainer(process.env.MONGO_IMAGE)
            .withCommand(['--replSet', 'rs0', '--bind_ip_all', '--wiredTigerCacheSizeGB', '0.25'])
            .withResourcesQuota({ memory: 1 })
            .start(),

        new GenericContainer(process.env.REDIS_IMAGE)
            .withExposedPorts(6379)
            .withResourcesQuota({ memory: 0.125 })
            .start(),

        new GenericContainer(process.env.S3_IMAGE)
            .withExposedPorts(7070)
            .withEnvironment({
                ROOT_ACCESS_KEY_ID: 'admin',
                ROOT_SECRET_ACCESS_KEY: 'password',
                VGW_REGION: 'us-east-1',
                VGW_PORT: ':7070',
                VGW_HEALTH: '/_/health',
                VGW_BACKEND: 'posix',
                VGW_BACKEND_ARGS: '/data'
            })
            .withTmpFs({ '/data': 'rw' })
            .withWaitStrategy(Wait.forHttp('/_/health', 7070))
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
    process.env.TESTLIB_S3_ENDPOINT = `http://${s3.getHost()}:${s3.getMappedPort(7070)}`
    process.env.TESTLIB_S3_ACCESS_KEY = 'admin'
    process.env.TESTLIB_S3_SECRET_KEY = 'password'
    // `NatsContainer`는 기본으로 사용자/비밀번호 인증을 켠다.
    // 테스트 코드가 인증 방식까지 알 필요 없도록 컨테이너가 제공한 연결 옵션 전체를 전달한다.
    process.env.TESTLIB_NATS_OPTIONS = JSON.stringify(nats.getConnectionOptions())
    process.env.TESTLIB_TEMPORAL_ADDRESS = temporalEnv.address
    process.env.TESTLIB_TEMPORAL_NAMESPACE = temporalEnv.namespace ?? 'default'

    // Jest의 `globalSetup`과 `globalTeardown`은 같은 프로세스에서 실행된다.
    // Temporal 테스트 환경은 자식 프로세스를 포함하므로, 인스턴스를 보관했다가 teardown에서 명시적으로 닫아야 Jest가 정상 종료된다.
    globalThis.__TEMPORAL_TEST_ENV__ = temporalEnv
}

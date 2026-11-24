const { GenericContainer, Wait } = require('testcontainers')
const { MongoDBContainer } = require('@testcontainers/mongodb')
const { NatsContainer } = require('@testcontainers/nats')

module.exports = async function globalSetup() {
    const storage = {
        ROOT_ACCESS_KEY_ID: 'admin',
        ROOT_SECRET_ACCESS_KEY: 'password',
        VGW_REGION: 'us-east-1',
        VGW_PORT: ':7070',
        VGW_HEALTH: '/_/health',
        VGW_BACKEND: 'posix',
        VGW_BACKEND_ARGS: '/data'
    }
    await using setup = new AsyncDisposableStack()
    const starts = [
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
            .withEnvironment(storage)
            .withTmpFs({ '/data': 'rw' })
            .withWaitStrategy(Wait.forHttp('/_/health', 7070))
            .withResourcesQuota({ memory: 0.5 })
            .start(),

        new NatsContainer(process.env.NATS_IMAGE)
            .withJetStream()
            .withResourcesQuota({ memory: 0.25 })
            .start()
    ]
    // 한 컨테이너가 실패해도 병렬로 시작한 나머지 컨테이너까지 회수한다.
    const results = await Promise.allSettled(starts.map(async (start) => setup.use(await start)))
    const [mongo, redis, s3, nats] = results.map((result) => {
        if (result.status === 'rejected') throw result.reason
        return result.value
    })

    const mongoUri = new URL(mongo.getConnectionString())
    mongoUri.searchParams.set('directConnection', 'true')
    process.env.TESTLIB_MONGO_URI = mongoUri.href
    process.env.TESTLIB_REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`
    process.env.TESTLIB_S3_OPTIONS = JSON.stringify({
        endpoint: `http://${s3.getHost()}:${s3.getMappedPort(7070)}`,
        region: storage.VGW_REGION,
        credentials: {
            accessKeyId: storage.ROOT_ACCESS_KEY_ID,
            secretAccessKey: storage.ROOT_SECRET_ACCESS_KEY
        },
        forcePathStyle: true
    })
    // `NatsContainer`는 기본으로 사용자/비밀번호 인증을 켠다.
    // 테스트 코드가 인증 방식까지 알 필요 없도록 컨테이너가 제공한 연결 옵션 전체를 전달한다.
    process.env.TESTLIB_NATS_OPTIONS = JSON.stringify(nats.getConnectionOptions())

    const containers = setup.move()
    return () => containers.disposeAsync()
}

const { GenericContainer } = require('testcontainers')
const { MongoDBContainer } = require('@testcontainers/mongodb')
const { NatsContainer } = require('@testcontainers/nats')

module.exports = async function globalSetup() {
    const [mongo, redis, minio, nats] = await Promise.all([
        new MongoDBContainer(process.env.MONGO_IMAGE)
            .withName('testlib-mongo')
            .withReuse()
            .withCommand(['--replSet', 'rs0', '--bind_ip_all', '--wiredTigerCacheSizeGB', '0.25'])
            .withResourcesQuota({ memory: 1 })
            .start(),

        new GenericContainer(process.env.REDIS_IMAGE)
            .withName('testlib-redis')
            .withReuse()
            .withExposedPorts(6379)
            .withResourcesQuota({ memory: 0.125 })
            .start(),

        new GenericContainer(process.env.MINIO_IMAGE)
            .withName('testlib-minio')
            .withReuse()
            .withExposedPorts(9000)
            .withEnvironment({ MINIO_ROOT_USER: 'admin', MINIO_ROOT_PASSWORD: 'password' })
            .withCommand(['server', '/data'])
            .withResourcesQuota({ memory: 0.5 })
            .start(),

        new NatsContainer(process.env.NATS_IMAGE)
            .withName('testlib-nats')
            .withReuse()
            .withJetStream()
            .withResourcesQuota({ memory: 0.25 })
            .start()
    ])

    process.env.TESTLIB_MONGO_URI = `${mongo.getConnectionString()}?directConnection=true`
    process.env.TESTLIB_REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`
    process.env.TESTLIB_S3_ENDPOINT = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`
    process.env.TESTLIB_S3_ACCESS_KEY = 'admin'
    process.env.TESTLIB_S3_SECRET_KEY = 'password'
    // NatsContainer enforces user/pass auth by default; pass the full
    // connection options through so consumers don't have to know about it.
    process.env.TESTLIB_NATS_OPTIONS = JSON.stringify(nats.getConnectionOptions())
}

const { GenericContainer } = require('testcontainers')
const { MongoDBContainer } = require('@testcontainers/mongodb')
const { NatsContainer } = require('@testcontainers/nats')
const { TestWorkflowEnvironment } = require('@temporalio/testing')

module.exports = async function globalSetup() {
    const [nats, mongo, redis, minio, temporal] = await Promise.all([
        new NatsContainer(process.env.NATS_IMAGE)
            .withName('testlib-nats')
            .withReuse()
            .withResourcesQuota({ memory: 0.25 })
            .start(),

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

        TestWorkflowEnvironment.createLocal()
    ])

    const natsOptions = nats.getConnectionOptions()
    process.env.TESTLIB_NATS_OPTIONS = JSON.stringify(natsOptions)
    process.env.TESTLIB_MONGO_URI = `${mongo.getConnectionString()}?directConnection=true`
    process.env.TESTLIB_REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`
    process.env.TESTLIB_S3_ENDPOINT = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`
    process.env.TESTLIB_S3_ACCESS_KEY = 'admin'
    process.env.TESTLIB_S3_SECRET_KEY = 'password'
    process.env.TESTLIB_TEMPORAL_ADDRESS = temporal.address
}

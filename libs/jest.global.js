const { GenericContainer, Wait } = require('testcontainers')
const { MongoDBContainer } = require('@testcontainers/mongodb')
const { NatsContainer } = require('@testcontainers/nats')

const TEMPORAL_NETWORK_NAME = 'testlib-temporal-net'
const TEMPORAL_PG_ALIAS = 'temporal-postgres'

module.exports = async function globalSetup() {
    // Temporal needs Postgres reachable by container alias, so both attach
    // to a stable user-defined docker network. We create it via dockerode
    // (idempotent) instead of testcontainers' Network class — that one
    // generates a fresh UUID-named network on every run, leaving orphans
    // when paired with withReuse().
    await ensureDockerNetwork(TEMPORAL_NETWORK_NAME)

    const [mongo, redis, minio, nats, temporal] = await Promise.all([
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
            .start(),

        startTemporal()
    ])

    process.env.TESTLIB_MONGO_URI = `${mongo.getConnectionString()}?directConnection=true`
    process.env.TESTLIB_REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`
    process.env.TESTLIB_S3_ENDPOINT = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`
    process.env.TESTLIB_S3_ACCESS_KEY = 'admin'
    process.env.TESTLIB_S3_SECRET_KEY = 'password'
    // NatsContainer enforces user/pass auth by default; pass the full
    // connection options through so consumers don't have to know about it.
    process.env.TESTLIB_NATS_OPTIONS = JSON.stringify(nats.getConnectionOptions())
    process.env.TESTLIB_TEMPORAL_ADDRESS = `${temporal.getHost()}:${temporal.getMappedPort(7233)}`
    process.env.TESTLIB_TEMPORAL_NAMESPACE = 'default'
}

async function startTemporal() {
    // Postgres must be ready before Temporal's auto-setup runs schema migrations.
    await new GenericContainer('postgres:17-alpine')
        .withName('testlib-temporal-pg')
        .withReuse()
        .withNetworkMode(TEMPORAL_NETWORK_NAME)
        .withNetworkAliases(TEMPORAL_PG_ALIAS)
        .withEnvironment({
            POSTGRES_USER: 'temporal',
            POSTGRES_PASSWORD: 'temporal',
            POSTGRES_DB: 'temporal'
        })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forSuccessfulCommand('pg_isready -U temporal'))
        .withResourcesQuota({ memory: 0.25 })
        .start()

    return new GenericContainer(process.env.TEMPORAL_IMAGE)
        .withName('testlib-temporal')
        .withReuse()
        .withNetworkMode(TEMPORAL_NETWORK_NAME)
        .withEnvironment({
            // Default Temporal binds gRPC only to the container's docker IP
            // (e.g. 172.21.0.3:7233), so localhost-based healthchecks fail.
            // BIND_ON_IP=0.0.0.0 makes the auto-setup entrypoint regenerate
            // config to listen on all interfaces.
            BIND_ON_IP: '0.0.0.0',
            DB: 'postgres12',
            DB_PORT: '5432',
            POSTGRES_USER: 'temporal',
            POSTGRES_PWD: 'temporal',
            POSTGRES_SEEDS: TEMPORAL_PG_ALIAS
        })
        .withExposedPorts(7233)
        // First boot runs schema migrations (~30s); reuse hits are fast.
        .withStartupTimeout(120_000)
        .withWaitStrategy(Wait.forSuccessfulCommand('tctl --address localhost:7233 cluster health'))
        .withResourcesQuota({ memory: 0.5 })
        .start()
}

async function ensureDockerNetwork(name) {
    const Docker = require('dockerode')
    const docker = new Docker()
    const existing = await docker.listNetworks({
        filters: JSON.stringify({ name: [name] })
    })
    if (existing.some((n) => n.Name === name)) return
    await docker.createNetwork({ Name: name, Driver: 'bridge', CheckDuplicate: true })
}

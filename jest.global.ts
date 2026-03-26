import { GenericContainer, Wait } from 'testcontainers'
import { NatsContainer } from '@testcontainers/nats'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { getEnv, setEnv } from './jest.utils'

export default async function globalSetup() {
    const [nats, mongo, redis, minio, temporal] = await Promise.all([
        new NatsContainer(getEnv('NATS_IMAGE'))
            .withName('testlib-nats')
            .withReuse()
            .withResourcesQuota({ memory: 0.25 })
            .start(),

        new GenericContainer(getEnv('MONGO_IMAGE'))
            .withName('testlib-mongo')
            .withReuse()
            .withExposedPorts(27017)
            .withCommand([
                '--replSet',
                'rs0',
                '--wiredTigerCacheSizeGB',
                '0.25',
                '--setParameter',
                'ttlMonitorSleepSecs=1'
            ])
            .withHealthCheck({
                test: [
                    'CMD-SHELL',
                    'mongosh --quiet --eval "try { rs.status(); } catch (e) { rs.initiate(); } while (db.runCommand({isMaster: 1}).ismaster==false) { sleep(100); }"'
                ],
                interval: 5000,
                timeout: 60000,
                retries: 1000
            })
            .withWaitStrategy(Wait.forHealthCheck())
            .withStartupTimeout(120_000)
            .withResourcesQuota({ memory: 1 })
            .start(),

        new GenericContainer(getEnv('REDIS_IMAGE'))
            .withName('testlib-redis')
            .withReuse()
            .withExposedPorts(6379)
            .withResourcesQuota({ memory: 0.125 })
            .start(),

        new GenericContainer(getEnv('MINIO_IMAGE'))
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
    setEnv('TESTLIB_NATS_OPTIONS', JSON.stringify(natsOptions))
    setEnv(
        'TESTLIB_MONGO_URI',
        `mongodb://${mongo.getHost()}:${mongo.getMappedPort(27017)}?directConnection=true`
    )
    setEnv('TESTLIB_REDIS_URL', `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`)
    setEnv('TESTLIB_S3_ENDPOINT', `http://${minio.getHost()}:${minio.getMappedPort(9000)}`)
    setEnv('TESTLIB_S3_REGION', 'us-east-1')
    setEnv('TESTLIB_S3_FORCE_PATH_STYLE', 'true')
    setEnv('TESTLIB_S3_ACCESS_KEY', 'admin')
    setEnv('TESTLIB_S3_SECRET_KEY', 'password')
    setEnv('TESTLIB_TEMPORAL_ADDRESS', temporal.address)
}

import { CacheNodeType, sleep } from 'common'
import Redis, { Cluster } from 'ioredis'
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers'

const CONTAINER_IMAGE = process.env.REDIS_IMAGE
if (!CONTAINER_IMAGE) {
    console.error('REDIS_IMAGE is not defined')
    process.exit(1)
}

const NETWORK = process.env.DOCKER_NETWORK
if (!NETWORK) {
    console.error('DOCKER_NETWORK is not defined')
    process.exit(1)
}

const PORT = 6379
const PASSWORD = 'pass'

const getName = (container: StartedTestContainer) => container.getName().replace(/^\//, '')

const startClusterContainers = async (): Promise<StartedTestContainer[]> => {
    return Promise.all(
        Array.from({ length: 6 }, async () => {
            const container = await new GenericContainer(CONTAINER_IMAGE)
                .withCommand([
                    'redis-server',
                    '--port',
                    PORT.toString(),
                    '--cluster-enabled',
                    'yes',
                    '--cluster-config-file',
                    'nodes.conf',
                    '--cluster-node-timeout',
                    '5000',
                    '--appendonly',
                    'yes',
                    '--requirepass',
                    PASSWORD,
                    '--masterauth',
                    PASSWORD
                ])
                .withWaitStrategy(Wait.forLogMessage('Ready to accept connections tcp'))
                .withNetworkMode(NETWORK)
                .start()
            return container
        })
    )
}

const startSingleContainer = async () => {
    const container = await new GenericContainer(CONTAINER_IMAGE)
        .withCommand(['redis-server', '--port', PORT.toString(), '--requirepass', PASSWORD])
        .withWaitStrategy(Wait.forLogMessage('Ready to accept connections tcp'))
        .withNetworkMode(NETWORK)
        .start()

    return container
}

const initiateContainers = async (containers: StartedTestContainer[]) => {
    const initCommand = [
        'sh',
        '-c',
        `echo 'yes' | redis-cli -a ${PASSWORD} --cluster create ` +
            `${getName(containers[0])}:${PORT} ` +
            `${getName(containers[1])}:${PORT} ` +
            `${getName(containers[2])}:${PORT} ` +
            `${getName(containers[3])}:${PORT} ` +
            `${getName(containers[4])}:${PORT} ` +
            `${getName(containers[5])}:${PORT} ` +
            '--cluster-replicas 1'
    ]

    const replicaSetInitiator = await new GenericContainer(CONTAINER_IMAGE)
        .withCommand(initCommand)
        .withWaitStrategy(Wait.forLogMessage(/\[OK\] All .* slots covered/))
        .withNetworkMode(NETWORK)
        .start()

    await replicaSetInitiator.stop()
}

export interface RedisContainerContext {
    nodes: CacheNodeType[]
    password: string
    close: () => void
}

const waitCluster = async (nodes: CacheNodeType[]) => {
    /* 종종 클러스터 설정이 완료되지 않는 경우가 있어서 최대 5초 기다린다 */
    for (let i = 0; i < 10; i++) {
        const redis = new Cluster(nodes, { redisOptions: { password: PASSWORD } })

        try {
            await redis.set('test', 'value')
        } catch (error) {
            await sleep(500)
        } finally {
            await redis.quit()
        }
    }
}

export async function createRedisCluster(): Promise<RedisContainerContext> {
    const containers = await startClusterContainers()
    await initiateContainers(containers)

    const nodes = containers.map((container) => ({ host: getName(container), port: PORT }))
    await waitCluster(nodes)

    const close = async () => {
        await Promise.all(containers.map((container) => container.stop()))
    }

    return { nodes, password: PASSWORD, close }
}

export async function createRedisSingle(): Promise<RedisContainerContext> {
    const container = await startSingleContainer()

    const nodes = [{ host: getName(container), port: PORT }]

    const redis = new Redis({
        host: nodes[0].host,
        port: nodes[0].port,
        password: PASSWORD
    })

    try {
        await redis.set('test', 'value')
        const value = await redis.get('test')
        if (value !== 'value') {
            throw new Error('Failed to connect to Redis')
        }
    } catch (error) {
        console.error('single error ---- ', error)
    } finally {
        await redis.quit()
    }

    const close = async () => await container.stop()

    return { nodes, password: PASSWORD, close }
}

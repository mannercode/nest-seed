import { CacheNodeType } from 'common'
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

export async function createRedisContainer(
    type: 'cluster' | 'single'
): Promise<RedisContainerContext> {
    let nodes: CacheNodeType[]
    let close: () => void

    if (type === 'cluster') {
        const containers = await startClusterContainers()
        await initiateContainers(containers)

        nodes = containers.map((container) => ({ host: getName(container), port: PORT }))

        close = async () => {
            await Promise.all(containers.map((container) => container.stop()))
        }
    } else if (type === 'single') {
        const container = await startSingleContainer()

        nodes = [{ host: getName(container), port: PORT }]
        close = async () => await container.stop()
    } else {
        throw new Error(`${type} is an unknown Redis type`)
    }

    return { nodes, password: PASSWORD, close }
}

import { RedisNode } from 'common'
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers'

function getString(key: string): string {
    const value = process.env[key]
    if (!value) {
        throw new Error(`Environment variable ${key} is not defined`)
    }
    return value
}

function getNumber(key: string): number {
    const value = getString(key)
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} must be a valid number`)
    }
    return parsed
}

function getContainerName(container: StartedTestContainer): string {
    const name = container.getName()
    return name.replace(/^\//, '')
}

export interface RedisConnectionContext {
    nodes: RedisNode[]
    password: string
}

export function getRedisTestConnection(): RedisConnectionContext {
    const hosts = [
        'REDIS_HOST1',
        'REDIS_HOST2',
        'REDIS_HOST3',
        'REDIS_HOST4',
        'REDIS_HOST5',
        'REDIS_HOST6'
    ].map((key) => getString(key))
    const port = getNumber('REDIS_PORT')
    const password = getString('REDIS_PASSWORD')
    const nodes = hosts.map((host) => ({ host, port }))

    return { nodes, password }
}

export interface MongoConnectionContext {
    uri: string
}

export const getMongoTestConnection = (): MongoConnectionContext => {
    const hosts = ['MONGO_HOST1', 'MONGO_HOST2', 'MONGO_HOST3'].map((key) => getString(key))
    const port = getNumber('MONGO_PORT')
    const replicaName = getString('MONGO_REPLICA')
    const username = getString('MONGO_USERNAME')
    const password = getString('MONGO_PASSWORD')
    const nodes = hosts.map((host) => `${host}:${port}`).join(',')

    const uri = `mongodb://${username}:${password}@${nodes}/?replicaSet=${replicaName}`
    return { uri }
}

export interface NatsContainersContext {
    servers: string[]
    hosts: string[]
    close: () => Promise<void>
}

export async function createNatsContainers(): Promise<NatsContainersContext> {
    const containers = new Array<StartedTestContainer>()

    const createContainer = async (name: string, addCommand: string[], waitMessage: RegExp) => {
        const natsImage = getString('NATS_IMAGE')

        return await new GenericContainer(natsImage)
            .withCommand([
                '--cluster_name',
                'nats-cluster',
                '--cluster',
                'nats://0.0.0.0:6222',
                ...addCommand
            ])
            .withName(name)
            .withNetworkMode('nest-seed')
            .withWaitStrategy(Wait.forLogMessage(waitMessage))
            .start()
    }

    const testId = getString('TEST_ID')
    containers.push(await createContainer(`${testId}-nats1`, [], /Server is ready/))
    containers.push(
        await createContainer(
            `${testId}-nats2`,
            [`--routes=nats://${testId}-nats1:6222`],
            /Server is ready/
        )
    )
    containers.push(
        await createContainer(
            `${testId}-nats3`,
            [`--routes=nats://${testId}-nats1:6222`],
            /rid:12 - Route connection created/
        )
    )
    const hosts = containers.map((container) => getContainerName(container))
    const servers = hosts.map((host) => `nats://${host}:${4222}`)

    const close = async () => {
        await Promise.all(containers.map((container) => container.stop()))
    }

    return { servers, close, hosts }
}

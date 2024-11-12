import { CacheNodeType } from 'common'

function getString(key: string): string {
    const value = process.env[key]
    if (!value) {
        console.error(`${key} is not defined`)
        process.exit(1)
    }
    return value
}

function getNumber(key: string): number {
    return parseInt(getString(key))
}

export interface RedisContainerContext {
    nodes: CacheNodeType[]
    password: string
}

export function createRedisCluster() {
    const hosts = [
        getString('TEST_REDIS_HOST1'),
        getString('TEST_REDIS_HOST2'),
        getString('TEST_REDIS_HOST3'),
        getString('TEST_REDIS_HOST4'),
        getString('TEST_REDIS_HOST5'),
        getString('TEST_REDIS_HOST6')
    ]
    const port = getNumber('TEST_REDIS_PORT')
    const password = getString('TEST_REDIS_PASSWORD')
    const nodes = hosts.map((host) => ({ host, port }))

    return { nodes, password }
}

export interface MongoContainerContext {
    uri: string
}

export const createMongoCluster = () => {
    const host1 = getString('TEST_MONGO_DB_HOST1')
    const host2 = getString('TEST_MONGO_DB_HOST2')
    const host3 = getString('TEST_MONGO_DB_HOST3')
    const port = getNumber('TEST_MONGO_DB_PORT')
    const replicaName = getString('TEST_MONGO_DB_REPLICA_NAME')
    const username = getString('TEST_MONGO_DB_USERNAME')
    const password = getString('TEST_MONGO_DB_PASSWORD')

    const uri = `mongodb://${username}:${password}@${host1}:${port},${host2}:${port},${host3}:${port}/?replicaSet=${replicaName}`

    return { uri }
}

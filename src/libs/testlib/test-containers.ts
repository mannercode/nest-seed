import { RedisNode } from 'common'

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

export interface RedisConnectionContext {
    nodes: RedisNode[]
    password: string
}

export function getRedisTestConnection(): RedisConnectionContext {
    const hosts = [
        'TEST_REDIS_HOST1',
        'TEST_REDIS_HOST2',
        'TEST_REDIS_HOST3',
        'TEST_REDIS_HOST4',
        'TEST_REDIS_HOST5',
        'TEST_REDIS_HOST6'
    ].map((key) => getString(key))
    const port = getNumber('TEST_REDIS_PORT')
    const password = getString('TEST_REDIS_PASSWORD')
    const nodes = hosts.map((host) => ({ host, port }))

    return { nodes, password }
}

export const getMongoTestConnection = (): string => {
    const hosts = ['TEST_MONGO_DB_HOST1', 'TEST_MONGO_DB_HOST2', 'TEST_MONGO_DB_HOST3'].map((key) =>
        getString(key)
    )
    const port = getNumber('TEST_MONGO_DB_PORT')
    const replicaName = getString('TEST_MONGO_DB_REPLICA_NAME')
    const username = getString('TEST_MONGO_DB_USERNAME')
    const password = getString('TEST_MONGO_DB_PASSWORD')
    const nodes = hosts.map((host) => `${host}:${port}`).join(',')

    const uri = `mongodb://${username}:${password}@${nodes}/?replicaSet=${replicaName}`
    return uri
}

export function getKafkaTestConnection(): string[] {
    const hosts = ['TEST_KAFKA_BROKER1', 'TEST_KAFKA_BROKER2', 'TEST_KAFKA_BROKER3'].map((key) =>
        getString(key)
    )
    const port = getNumber('KAFKA_PORT')
    const brokers = hosts.map((host) => `${host}:${port}`)

    return brokers
}

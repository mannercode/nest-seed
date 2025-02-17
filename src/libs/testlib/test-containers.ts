import { Environment, RedisNode } from 'common'

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
    ].map((key) => Environment.getString(key))
    const port = Environment.getNumber('REDIS_PORT')
    const password = Environment.getString('REDIS_PASSWORD')
    const nodes = hosts.map((host) => ({ host, port }))

    return { nodes, password }
}

export interface MongoConnectionContext {
    uri: string
}

export const getMongoTestConnection = (): MongoConnectionContext => {
    const hosts = ['MONGO_HOST1', 'MONGO_HOST2', 'MONGO_HOST3'].map((key) =>
        Environment.getString(key)
    )
    const port = Environment.getNumber('MONGO_PORT')
    const replicaName = Environment.getString('MONGO_REPLICA')
    const username = Environment.getString('MONGO_USERNAME')
    const password = Environment.getString('MONGO_PASSWORD')
    const nodes = hosts.map((host) => `${host}:${port}`).join(',')

    const uri = `mongodb://${username}:${password}@${nodes}/?replicaSet=${replicaName}`
    return { uri }
}

export interface NatsConnectionContext {
    servers: string[]
}

export const getNatsTestConnection = (): NatsConnectionContext => {
    const hosts = ['NATS_HOST1', 'NATS_HOST2', 'NATS_HOST3'].map((key) =>
        Environment.getString(key)
    )
    const port = Environment.getNumber('NATS_PORT')
    const servers = hosts.map((host) => `nats://${host}:${port}`)
    return { servers }
}

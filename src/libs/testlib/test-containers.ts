import { EnvVars } from './utils'

export interface RedisConnectionContext {
    nodes: { host: string; port: number }[]
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
    ].map((key) => EnvVars.getString(key))
    const port = EnvVars.getNumber('TEST_REDIS_PORT')
    const password = EnvVars.getString('TEST_REDIS_PASSWORD')
    const nodes = hosts.map((host) => ({ host, port }))

    return { nodes, password }
}

export interface MongoConnectionContext {
    uri: string
}

export const getMongoTestConnection = (): MongoConnectionContext => {
    const hosts = ['TEST_MONGO_HOST1', 'TEST_MONGO_HOST2', 'TEST_MONGO_HOST3'].map((key) =>
        EnvVars.getString(key)
    )
    const port = EnvVars.getNumber('TEST_MONGO_PORT')
    const replicaName = EnvVars.getString('TEST_MONGO_REPLICA')
    const username = EnvVars.getString('TEST_MONGO_USERNAME')
    const password = EnvVars.getString('TEST_MONGO_PASSWORD')
    const nodes = hosts.map((host) => `${host}:${port}`).join(',')
    const uri = `mongodb://${username}:${password}@${nodes}/?replicaSet=${replicaName}`

    return { uri }
}

export interface NatsConnectionContext {
    servers: string[]
}

export const getNatsTestConnection = (): NatsConnectionContext => {
    const hosts = ['TEST_NATS_HOST1', 'TEST_NATS_HOST2', 'TEST_NATS_HOST3'].map((key) =>
        EnvVars.getString(key)
    )
    const port = EnvVars.getNumber('TEST_NATS_PORT')
    const servers = hosts.map((host) => `nats://${host}:${port}`)

    return { servers }
}
// TODO 이거 왜 env를 직접 쓰지? TEST_ 붙여라. setup.ts에서 설정하고

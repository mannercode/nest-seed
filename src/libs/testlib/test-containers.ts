import { EnvVars } from './utils'

export interface RedisConnectionContext {
    nodes: { host: string; port: number }[]
    password: string
}

export function getRedisTestConnection(): RedisConnectionContext {
    const password = EnvVars.getString('TEST_REDIS_PASSWORD')
    const nodes = [
        {
            host: EnvVars.getString('TEST_REDIS_HOST1'),
            port: EnvVars.getNumber('TEST_REDIS_PORT1')
        },
        {
            host: EnvVars.getString('TEST_REDIS_HOST2'),
            port: EnvVars.getNumber('TEST_REDIS_PORT2')
        },
        {
            host: EnvVars.getString('TEST_REDIS_HOST3'),
            port: EnvVars.getNumber('TEST_REDIS_PORT3')
        },
        {
            host: EnvVars.getString('TEST_REDIS_HOST4'),
            port: EnvVars.getNumber('TEST_REDIS_PORT4')
        },
        {
            host: EnvVars.getString('TEST_REDIS_HOST5'),
            port: EnvVars.getNumber('TEST_REDIS_PORT5')
        },
        { host: EnvVars.getString('TEST_REDIS_HOST6'), port: EnvVars.getNumber('TEST_REDIS_PORT6') }
    ]

    return { password, nodes }
}

export interface NatsConnectionContext {
    servers: string[]
}

export const getNatsTestConnection = (): NatsConnectionContext => {
    const servers = [
        `nats://${EnvVars.getString('TEST_NATS_HOST1')}:${EnvVars.getNumber('TEST_NATS_PORT1')}`,
        `nats://${EnvVars.getString('TEST_NATS_HOST2')}:${EnvVars.getNumber('TEST_NATS_PORT2')}`,
        `nats://${EnvVars.getString('TEST_NATS_HOST3')}:${EnvVars.getNumber('TEST_NATS_PORT3')}`
    ]

    return { servers }
}

export interface MongoConnectionContext {
    uri: string
}

export const getMongoTestConnection = (): MongoConnectionContext => {
    const replica = EnvVars.getString('TEST_MONGO_REPLICA')
    const username = EnvVars.getString('TEST_MONGO_USERNAME')
    const password = EnvVars.getString('TEST_MONGO_PASSWORD')
    const nodes = [
        `${EnvVars.getString('TEST_MONGO_HOST1')}:${EnvVars.getNumber('TEST_MONGO_PORT1')}`,
        `${EnvVars.getString('TEST_MONGO_HOST2')}:${EnvVars.getNumber('TEST_MONGO_PORT2')}`,
        `${EnvVars.getString('TEST_MONGO_HOST3')}:${EnvVars.getNumber('TEST_MONGO_PORT3')}`
    ].join(',')

    const uri = `mongodb://${username}:${password}@${nodes}/?replicaSet=${replica}`

    return { uri }
}

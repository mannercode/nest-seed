import { Env } from './utils'

export interface RedisConnectionContext {
    nodes: { host: string; port: number }[]
    password: string
}

export function getRedisTestConnection(): RedisConnectionContext {
    const password = Env.getString('TEST_REDIS_PASSWORD')
    const nodes = [
        { host: Env.getString('TEST_REDIS_HOST1'), port: Env.getNumber('TEST_REDIS_PORT1') },
        { host: Env.getString('TEST_REDIS_HOST2'), port: Env.getNumber('TEST_REDIS_PORT2') },
        { host: Env.getString('TEST_REDIS_HOST3'), port: Env.getNumber('TEST_REDIS_PORT3') },
        { host: Env.getString('TEST_REDIS_HOST4'), port: Env.getNumber('TEST_REDIS_PORT4') },
        { host: Env.getString('TEST_REDIS_HOST5'), port: Env.getNumber('TEST_REDIS_PORT5') },
        { host: Env.getString('TEST_REDIS_HOST6'), port: Env.getNumber('TEST_REDIS_PORT6') }
    ]

    return { password, nodes }
}

export interface NatsConnectionContext {
    servers: string[]
}

export const getNatsTestConnection = (): NatsConnectionContext => {
    const servers = [
        `nats://${Env.getString('TEST_NATS_HOST1')}:${Env.getNumber('TEST_NATS_PORT1')}`,
        `nats://${Env.getString('TEST_NATS_HOST2')}:${Env.getNumber('TEST_NATS_PORT2')}`,
        `nats://${Env.getString('TEST_NATS_HOST3')}:${Env.getNumber('TEST_NATS_PORT3')}`
    ]

    return { servers }
}

export interface MongoConnectionContext {
    uri: string
    dbName: string
}

export const getMongoTestConnection = (): MongoConnectionContext => {
    const replicaSet = Env.getString('TEST_MONGO_REPLICA_SET')
    const username = Env.getString('TEST_MONGO_USERNAME')
    const password = Env.getString('TEST_MONGO_PASSWORD')
    const nodes = [
        `${Env.getString('TEST_MONGO_HOST1')}:${Env.getNumber('TEST_MONGO_PORT1')}`,
        `${Env.getString('TEST_MONGO_HOST2')}:${Env.getNumber('TEST_MONGO_PORT2')}`,
        `${Env.getString('TEST_MONGO_HOST3')}:${Env.getNumber('TEST_MONGO_PORT3')}`
    ].join(',')

    const uri = `mongodb://${username}:${password}@${nodes}/?replicaSet=${replicaSet}`
    const dbName = Env.getString('TEST_MONGO_DATABASE')

    return { uri, dbName }
}

export interface S3ConnectionContext {
    endpoint: string
    region: string
    accessKeyId: string
    secretAccessKey: string
    bucket: string
    forcePathStyle: boolean
}

export const getS3TestConnection = (): S3ConnectionContext => {
    const endpoint = Env.getString('TEST_S3_ENDPOINT')
    const region = Env.getString('TEST_S3_REGION')
    const accessKeyId = Env.getString('TEST_S3_ACCESS_KEY_ID')
    const secretAccessKey = Env.getString('TEST_S3_SECRET_ACCESS_KEY')
    const bucket = Env.getString('TEST_S3_BUCKET')
    const forcePathStyle = Env.getBoolean('TEST_S3_FORCE_PATH_STYLE')

    return { endpoint, region, accessKeyId, secretAccessKey, bucket, forcePathStyle }
}

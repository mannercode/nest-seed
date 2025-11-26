import dotenv from 'dotenv'
import 'reflect-metadata'
import { MongoClient } from 'mongodb'

dotenv.config({ quiet: true })
process.env.NODE_ENV = 'test'

const copyEnvToTest = (keys: readonly string[]) =>
    keys.forEach((key) => {
        process.env[`TEST_${key}`] = process.env[key]
    })

copyEnvToTest([
    'REDIS_PASSWORD',
    'REDIS_HOST1',
    'REDIS_PORT1',
    'REDIS_HOST2',
    'REDIS_PORT2',
    'REDIS_HOST3',
    'REDIS_PORT3',
    'REDIS_HOST4',
    'REDIS_PORT4',
    'REDIS_HOST5',
    'REDIS_PORT5',
    'REDIS_HOST6',
    'REDIS_PORT6'
])

copyEnvToTest([
    'MONGO_REPLICA_SET',
    'MONGO_USERNAME',
    'MONGO_PASSWORD',
    'MONGO_HOST1',
    'MONGO_PORT1',
    'MONGO_HOST2',
    'MONGO_PORT2',
    'MONGO_HOST3',
    'MONGO_PORT3'
])

copyEnvToTest(['NATS_HOST1', 'NATS_PORT1', 'NATS_HOST2', 'NATS_PORT2', 'NATS_HOST3', 'NATS_PORT3'])

copyEnvToTest([
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_FORCE_PATH_STYLE'
])

const generateTestId = () => {
    const characters = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'

    return Array.from(
        { length: 10 },
        () => characters[Math.floor(Math.random() * characters.length)]
    ).join('')
}

let mongoClient: MongoClient
let mongo_uri = ''

beforeAll(async () => {
    const replicaSet = process.env.TEST_MONGO_REPLICA_SET
    const username = process.env.TEST_MONGO_USERNAME
    const password = process.env.TEST_MONGO_PASSWORD
    const nodes = [
        `${process.env.TEST_MONGO_HOST1}:${process.env.TEST_MONGO_PORT1}`,
        `${process.env.TEST_MONGO_HOST2}:${process.env.TEST_MONGO_PORT2}`,
        `${process.env.TEST_MONGO_HOST3}:${process.env.TEST_MONGO_PORT3}`
    ].join(',')

    mongo_uri = `mongodb://${username}:${password}@${nodes}/?replicaSet=${replicaSet}`

    mongoClient = new MongoClient(mongo_uri)
    await mongoClient.connect()
})

global.beforeEach(async () => {
    const testId = generateTestId()

    process.env.TEST_ID = testId
    process.env.PROJECT_ID = `project-${testId}`
    process.env.MONGO_DATABASE = `mongodb-${testId}`

    copyEnvToTest(['MONGO_DATABASE'])
})

afterEach(async () => {
    const dbName = process.env.MONGO_DATABASE

    try {
        await mongoClient.db(dbName).dropDatabase()
    } catch (err: any) {
        // 테스트에서 DB를 안 썼다면 컬렉션이 없어도 무시
        if (err?.codeName !== 'NamespaceNotFound') throw err
    }
})

afterAll(async () => {
    await mongoClient?.close()
})

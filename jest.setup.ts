import dotenv from 'dotenv'
import 'reflect-metadata'
import { MongoClient } from 'mongodb'

dotenv.config({ path: ['.env'], quiet: true })
process.env.NODE_ENV = 'test'

const generateTestId = () => {
    const characters = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'

    return Array.from(
        { length: 10 },
        () => characters[Math.floor(Math.random() * characters.length)]
    ).join('')
}

let mongoClient: MongoClient

beforeAll(async () => {
    const replicaSet = process.env.MONGO_REPLICA_SET
    const username = process.env.MONGO_USERNAME
    const password = process.env.MONGO_PASSWORD
    const nodes = [
        `${process.env.MONGO_HOST1}:${process.env.MONGO_PORT1}`,
        `${process.env.MONGO_HOST2}:${process.env.MONGO_PORT2}`,
        `${process.env.MONGO_HOST3}:${process.env.MONGO_PORT3}`
    ].join(',')

    mongoClient = new MongoClient(
        `mongodb://${username}:${password}@${nodes}/?replicaSet=${replicaSet}`
    )

    await mongoClient.connect()
})

afterAll(async () => {
    await mongoClient.close()
})

beforeEach(async () => {
    const testId = generateTestId()

    process.env.TEST_ID = testId
    process.env.PROJECT_ID = `project-${testId}`
    process.env.MONGO_DATABASE = `mongo-${testId}`
})

afterEach(async () => {
    await mongoClient.db(process.env.MONGO_DATABASE).dropDatabase()
})

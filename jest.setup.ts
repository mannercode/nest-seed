import dotenv from 'dotenv'
import 'reflect-metadata'
import { MongoClient } from 'mongodb'

dotenv.config({ quiet: true })

const generateTestId = () => {
    const characters = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'

    return Array.from(
        { length: 10 },
        () => characters[Math.floor(Math.random() * characters.length)]
    ).join('')
}

let appsMongoClient: MongoClient
let testlibMongoClient: MongoClient

beforeAll(async () => {
    const replicaSet = process.env.MONGO_REPLICA_SET
    const username = process.env.MONGO_USERNAME
    const password = process.env.MONGO_PASSWORD
    const nodes = [
        `${process.env.MONGO_HOST1}:${process.env.MONGO_PORT1}`,
        `${process.env.MONGO_HOST2}:${process.env.MONGO_PORT2}`,
        `${process.env.MONGO_HOST3}:${process.env.MONGO_PORT3}`
    ].join(',')

    appsMongoClient = new MongoClient(
        `mongodb://${username}:${password}@${nodes}/?replicaSet=${replicaSet}`
    )
    testlibMongoClient = new MongoClient(process.env.TESTLIB_MONGO_URI!)

    await appsMongoClient.connect()
    await testlibMongoClient.connect()

    // TTL 인덱스 expires 동작을 빠르게 테스트하기 위해 TTL 모니터 주기를 1초로 설정
    // Set TTL monitor interval to 1s to speed up TTL index `expires` tests
    await testlibMongoClient.db('admin').command({ setParameter: 1, ttlMonitorSleepSecs: 1 })
})

afterAll(async () => {
    await appsMongoClient.close()
    await testlibMongoClient.close()
})

beforeEach(async () => {
    const testId = generateTestId()

    process.env.TEST_ID = testId
    process.env.PROJECT_ID = `project-${testId}`
    process.env.MONGO_DATABASE = `mongo-${testId}`
    process.env.TESTLIB_MONGO_DATABASE = `mongo-${testId}`
})

afterEach(async () => {
    await appsMongoClient.db(process.env.MONGO_DATABASE).dropDatabase()
    await testlibMongoClient.db(process.env.TESTLIB_MONGO_DATABASE).dropDatabase()
})

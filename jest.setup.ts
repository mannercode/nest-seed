import { MongoClient } from 'mongodb'
import 'reflect-metadata'
import { generateTestId, getEnv, setEnv } from './jest.utils'

let appsMongoClient: MongoClient
let testlibMongoClient: MongoClient

beforeAll(async () => {
    const nodes = [
        `${getEnv('MONGO_HOST1')}:${getEnv('MONGO_PORT1')}`,
        `${getEnv('MONGO_HOST2')}:${getEnv('MONGO_PORT2')}`,
        `${getEnv('MONGO_HOST3')}:${getEnv('MONGO_PORT3')}`
    ].join(',')

    appsMongoClient = new MongoClient(
        `mongodb://${getEnv('MONGO_USERNAME')}:${getEnv('MONGO_PASSWORD')}@${nodes}/?replicaSet=${getEnv('MONGO_REPLICA_SET')}`
    )
    await appsMongoClient.connect()

    testlibMongoClient = new MongoClient(getEnv('TESTLIB_MONGO_URI'))
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

    setEnv('TEST_ID', testId)
    setEnv('PROJECT_ID', `project-${testId}`)
    setEnv('MONGO_DATABASE', `mongo-${testId}`)
    setEnv('TESTLIB_MONGO_DATABASE', `mongo-${testId}`)
})

afterEach(async () => {
    await appsMongoClient.db(getEnv('MONGO_DATABASE')).dropDatabase()
    await testlibMongoClient.db(getEnv('TESTLIB_MONGO_DATABASE')).dropDatabase()
})
